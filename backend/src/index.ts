import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { hash, compare } from 'bcryptjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import {operations,DomainError} from './modules/operations';
import {appRouter} from './modules/app';
import { registration, login, farmInput, organizationInput } from './validation';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet(),express.json({limit:'3mb'}),cookieParser());
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
app.use((req,res,next)=>{
 if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin !== origin) {res.status(403).json({error:'Untrusted request origin'});return;}
 next();
});
const cookie = {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const slugify=(value:string)=>value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').trim().replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'workspace';
async function session(res:Response,userId:string){
 const token=randomBytes(32).toString('hex');
 await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[digest(token),userId]);
 res.cookie('dm_session',token,{...cookie,maxAge:7*86400000});
}
async function authenticated(req:Request,res:Response,next:NextFunction){
 const token=req.cookies.dm_session;
 if(typeof token!=='string'){res.status(401).json({error:'Please sign in'});return;}
 const {rows}=await db.query('SELECT u.id,u.name,u.email,u.two_factor_enabled FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(token)]);
 if(!rows[0]){res.status(401).json({error:'Session expired. Please sign in'});return;}
 res.locals.user=rows[0];next();
}
async function createOrganization(client:any,userId:string,name:string){
 const id=randomUUID();
 const slug=`${slugify(name)}-${randomBytes(4).toString('hex')}`;
 await client.query('INSERT INTO organizations(id,name,slug,created_by) VALUES($1,$2,$3,$4)',[id,name,slug,userId]);
 await client.query('INSERT INTO organization_members(org_id,user_id,role) VALUES($1,$2,$3)',[id,userId,'OWNER']);
 return {id,name,slug};
}
async function getPrimaryOrganizationId(userId:string,client:any=db){
 const {rows}=await client.query('SELECT o.id FROM organizations o JOIN organization_members om ON om.org_id=o.id WHERE om.user_id=$1 ORDER BY o.created_at LIMIT 1',[userId]);
 return rows[0]?.id as string|undefined;
}
app.get('/health',(_req,res)=>res.json({status:'ok'}));
app.get('/ready',async(_req,res)=>{await db.query('SELECT 1');res.json({status:'ready'});});
app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
const authLimit=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many attempts. Please try again later.'}});
app.post('/api/v1/auth/register',authLimit,async(req,res)=>{
 const input=registration.parse(req.body);const id=randomUUID();
 const passwordHash=await hash(input.password,12);const token=randomBytes(32).toString('hex');const client=await db.connect();
 try{await client.query('BEGIN');
  try{await client.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',[id,input.name,input.email,passwordHash]);}
  catch(e){await client.query('ROLLBACK');if((e as {code:string}).code==='23505'){res.status(409).json({error:'Unable to create account with this email. Try signing in.'});return;}throw e;}
  await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[digest(token),id]);
  await createOrganization(client,id,`${input.name}'s workspace`);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 res.cookie('dm_session',token,{...cookie,maxAge:7*86400000});res.status(201).json({id,name:input.name,email:input.email});
});
app.post('/api/v1/auth/login',authLimit,async(req,res)=>{
 const input=login.parse(req.body);
 const {rows}=await db.query('SELECT * FROM users WHERE email=$1',[input.email]);
 if(!rows[0] || !await compare(input.password,rows[0].password_hash)){res.status(401).json({error:'Email or password is incorrect'});return;}
 await session(res,rows[0].id);res.json({id:rows[0].id,name:rows[0].name,email:rows[0].email});
});
app.post('/api/v1/auth/check-email',authLimit,async(req,res)=>{
 const email=z.email().transform(v=>v.trim().toLowerCase()).parse(req.body?.email);
 const exists=Boolean((await db.query('SELECT 1 FROM users WHERE email=$1',[email])).rowCount);
 res.json({exists});
});
app.get('/api/v1/auth/me',authenticated,(_req,res)=>res.json(res.locals.user));
app.put('/api/v1/auth/profile',authenticated,async(req,res)=>{
 const input=z.object({name:z.string().trim().min(2).max(100),two_factor_enabled:z.boolean()}).parse(req.body);
 const {rows}=await db.query('UPDATE users SET name=$1,two_factor_enabled=$2 WHERE id=$3 RETURNING id,name,email,two_factor_enabled',[input.name,input.two_factor_enabled,res.locals.user.id]);
 res.json(rows[0]);
});
app.post('/api/v1/auth/change-password',authenticated,async(req,res)=>{
 const input=z.object({current_password:z.string().min(1),new_password:z.string().min(6).max(72)}).parse(req.body);
 const {rows}=await db.query('SELECT password_hash FROM users WHERE id=$1',[res.locals.user.id]);
 if(!rows[0]||!await compare(input.current_password,rows[0].password_hash))throw new DomainError(400,'Current password is incorrect');
 const passwordHash=await hash(input.new_password,12);
 const tokens=await db.query('SELECT token_hash FROM sessions WHERE user_id=$1',[res.locals.user.id]);
 const current=req.cookies?.dm_session?digest(req.cookies.dm_session):null;
 await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,res.locals.user.id]);
 for(const t of tokens.rows)if(t.token_hash!==current)await db.query('DELETE FROM sessions WHERE token_hash=$1',[t.token_hash]);
 res.clearCookie('dm_session',cookie);
 res.status(200).json({ok:true,message:'Password changed. Please sign in again.'});
});
app.post('/api/v1/auth/logout',async(req,res)=>{
 if(typeof req.cookies.dm_session==='string')await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.cookies.dm_session)]);
 res.clearCookie('dm_session',cookie).status(204).end();
});
app.get('/api/v1/organizations',authenticated,async(_req,res)=>{
 const {rows}=await db.query(`SELECT o.id,o.name,o.slug,o.created_at, om.role, (SELECT count(*)::int FROM farms f WHERE f.organization_id=o.id) AS farm_count
  FROM organizations o JOIN organization_members om ON om.org_id=o.id
  WHERE om.user_id=$1 ORDER BY o.created_at`,[res.locals.user.id]);
 res.json(rows);
});
app.post('/api/v1/organizations',authenticated,async(req,res)=>{
 const input=organizationInput.parse(req.body);const client=await db.connect();
 try{
  await client.query('BEGIN');
  const org=await createOrganization(client,res.locals.user.id,input.name);
  await client.query('COMMIT');
  res.status(201).json(org);
 }catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23505'){res.status(409).json({error:'An organization with this name already exists.'});return;}throw e;}finally{client.release();}
});
app.get('/api/v1/farms',authenticated,async(_req,res)=>{
 const {rows}=await db.query(`SELECT f.*,m.role,o.name AS organization_name,o.slug AS organization_slug,o.id AS organization_id
  FROM farms f
  JOIN farm_members m ON m.farm_id=f.id
  LEFT JOIN organizations o ON o.id=f.organization_id
  WHERE m.user_id=$1 ORDER BY COALESCE(o.created_at,f.created_at), f.created_at`,[res.locals.user.id]);res.json(rows);
});
app.get('/api/v1/farms/:id',authenticated,async(req,res)=>{
 if(!z.uuid().safeParse(req.params.id).success){res.status(404).json({error:'Farm not found'});return;}
 const {rows}=await db.query('SELECT f.*,m.role,o.name AS organization_name,o.slug AS organization_slug,o.id AS organization_id FROM farms f JOIN farm_members m ON m.farm_id=f.id LEFT JOIN organizations o ON o.id=f.organization_id WHERE f.id=$1 AND m.user_id=$2',[req.params.id,res.locals.user.id]);
 if(!rows[0]){res.status(404).json({error:'Farm not found'});return;}res.json(rows[0]);
});
app.post('/api/v1/farms',authenticated,async(req,res)=>{
 const input=farmInput.parse(req.body);const id=randomUUID();const client=await db.connect();
 try{await client.query('BEGIN');
 let organizationId=input.organizationId||await getPrimaryOrganizationId(res.locals.user.id,client);
 if(organizationId){const allowed=await client.query('SELECT 1 FROM organization_members WHERE org_id=$1 AND user_id=$2',[organizationId,res.locals.user.id]);if(!allowed.rowCount)throw new DomainError(403,'You do not belong to this organization');}
 if(!organizationId){organizationId=(await createOrganization(client,res.locals.user.id,'Personal workspace')).id;}
 await client.query('INSERT INTO farms(id,name,city,currency,organization_id,address,email,phone,country,postal_code,contact_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,input.name,input.city,input.currency,organizationId,input.address,input.email,input.phone,input.country,input.postal_code,input.contact_name]);
 await client.query("INSERT INTO farm_members(farm_id,user_id,role) VALUES($1,$2,'OWNER')",[id,res.locals.user.id]);
 await client.query("INSERT INTO audit_logs(id,farm_id,user_id,action) VALUES($1,$2,$3,'farm.created')",[randomUUID(),id,res.locals.user.id]);
 await client.query('COMMIT');res.status(201).json({id,...input,organization_id:organizationId,role:'OWNER',version:1});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
app.put('/api/v1/farms/:id',authenticated,async(req,res)=>{
 const id=z.uuid().parse(req.params.id);
 const expected=z.number().int().positive().parse(req.body.version);
 const input=farmInput.omit({organizationId:true}).parse(req.body);
 const client=await db.connect();
 try{await client.query('BEGIN');
  const old=(await client.query('SELECT * FROM farms WHERE id=$1 FOR UPDATE',[id])).rows[0];
  const member=(await client.query('SELECT role FROM farm_members WHERE farm_id=$1 AND user_id=$2',[id,res.locals.user.id])).rows[0];
  if(!old||!member)throw new DomainError(404,'Farm not found');
  if(member.role!=='OWNER')throw new DomainError(403,'Only farm owners can edit farm details');
  if(old.version!==expected)throw new DomainError(409,'Farm details changed. Reload before editing.');
  const keys=Object.keys(input);
  const row=(await client.query(`UPDATE farms SET ${keys.map((key,i)=>key+'=$'+(i+2)).join(',')},version=version+1 WHERE id=$1 RETURNING *`,[id,...Object.values(input)])).rows[0];
  await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,old_value,new_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,res.locals.user.id,'farm.updated',id,JSON.stringify(old),JSON.stringify(row)]);
  await client.query('COMMIT');res.json({...row,role:member.role});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
app.use('/api/v1/farms/:farmId',authenticated,operations);
app.use('/api/v1/farms/:farmId',authenticated,appRouter);
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
 if(err instanceof Error&&'status' in err&&Number(err.status)===400){res.status(400).json({error:err.message});return;}
 if(err instanceof DomainError){res.status(err.status).json({error:err.message});return;}
 const code=(err as {code?:string})?.code;
 if(code==='23505'){res.status(409).json({error:'A record with these identifying details already exists.'});return;}
 if(code==='23503'||code==='23514'){res.status(400).json({error:'The record has an invalid reference or value.'});return;}
 if(err instanceof z.ZodError){res.status(400).json({error:err.issues[0].message});return;}
 console.error('Request failed',err instanceof Error?err.message:'Unknown error');
 res.status(503).json({error:'Service temporarily unavailable. Please try again shortly.'});
});
if(!process.env.DATABASE_URL)console.warn('DATABASE_URL is missing. Configure PostgreSQL to enable accounts and farms.');
app.listen(Number(process.env.API_PORT)||4000,'0.0.0.0',()=>console.log('DairyMonitor API ready'));
