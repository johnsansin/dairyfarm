import {Router,type NextFunction,type Request,type Response} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import net from 'node:net';
import path from 'node:path';
import {mkdirSync,createWriteStream,readdirSync,statSync} from 'node:fs';
import {db} from '../db';
import {DomainError} from './operations';

export const adminRouter=Router();

async function requireSuperadmin(req:Request,res:Response,next:NextFunction){
 if(!res.locals.user?.is_superadmin){res.status(403).json({error:'Admin access required'});return;}
 next();
}
adminRouter.use(requireSuperadmin);

function adminAudit(adminUserId:string,action:string,recordType:string|null,recordId:string|null,detail:unknown=null){
 return db.query('INSERT INTO admin_audit_logs(id,admin_user_id,action,record_type,record_id,detail) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),adminUserId,action,recordType,recordId,JSON.stringify(detail??null)]);
}

adminRouter.get('/stats',async(_req,res)=>{
  const {rows}=await db.query(`SELECT
   (SELECT count(*)::int FROM users) AS users,
   (SELECT count(*)::int FROM users WHERE is_active) AS active_users,
   (SELECT count(*)::int FROM users WHERE is_superadmin) AS superadmins,
   (SELECT count(*)::int FROM organizations) AS organizations,
   (SELECT count(*)::int FROM farms) AS farms,
   (SELECT count(*)::int FROM farms WHERE is_active) AS active_farms,
   (SELECT count(*)::int FROM farms WHERE NOT is_active) AS suspended_farms,
   (SELECT count(*)::int FROM animals) AS animals,
   (SELECT count(*)::int FROM animals WHERE disposition='Active' AND production_status='Lactating') AS lactating,
   (SELECT COALESCE(sum(quantity),0)::text FROM milk WHERE date=(now() AT TIME ZONE 'Asia/Karachi')::date) AS milk_today,
   (SELECT count(*)::int FROM sessions WHERE expires_at>now()) AS active_sessions`);
  res.json(rows[0]);
});

adminRouter.get('/farms',async(req,res)=>{
  const search=z.string().max(200).default('').parse(req.query.search);
  const status=z.enum(['all','active','suspended']).default('all').parse(req.query.status);
  const limit=z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit);
  const offset=z.coerce.number().int().min(0).default(0).parse(req.query.offset);
  const params={limit,offset,like:'%'+search+'%'};
  const statusClause=status==='active'?'f.is_active=TRUE':status==='suspended'?'f.is_active=FALSE':'';
  const where=search?`(f.name ILIKE $3 OR f.city ILIKE $3 OR f.country ILIKE $3 OR f.contact_name ILIKE $3 OR o.name ILIKE $3 OR own.owner_name ILIKE $3 OR own.owner_email ILIKE $3)${statusClause?' AND '+statusClause:''}`:statusClause?statusClause:'TRUE';
  const whereCount=search?`(f.name ILIKE $1 OR f.city ILIKE $1 OR f.country ILIKE $1 OR f.contact_name ILIKE $1 OR o.name ILIKE $1 OR own.owner_name ILIKE $1 OR own.owner_email ILIKE $1)${statusClause?' AND '+statusClause:''}`:statusClause?statusClause:'TRUE';
  const joins=`LEFT JOIN organizations o ON o.id=f.organization_id
    LEFT JOIN LATERAL (
      SELECT u2.id::text AS owner_id,u2.name AS owner_name,u2.email AS owner_email
      FROM farm_members m2 JOIN users u2 ON u2.id=m2.user_id
      WHERE m2.farm_id=f.id ORDER BY m2.user_id LIMIT 1
    ) own ON TRUE`;
  const select=`SELECT f.id,f.name,f.city,f.country,f.currency,f.is_active,f.created_at::text,
    o.name AS organization_name,own.owner_id AS owner_id,own.owner_name AS owner_name,own.owner_email AS owner_email,
    (SELECT count(*)::int FROM animals a WHERE a.farm_id=f.id) AS animal_count,
    (SELECT count(*)::int FROM farm_members fm WHERE fm.farm_id=f.id) AS member_count
    FROM farms f ${joins} WHERE ${where}`;
  const rows=(await db.query(`${select} ORDER BY f.created_at DESC LIMIT $1 OFFSET $2`,search?[limit,offset,params.like]:[limit,offset])).rows;
  const total=(await db.query(`SELECT count(*)::int AS total FROM farms f ${joins} WHERE ${whereCount}`,search?[params.like]:[])).rows[0].total;
  res.json({rows,total,limit,offset});
});

adminRouter.get('/organizations',async(req,res)=>{
  const search=z.string().max(200).default('').parse(req.query.search);
  const limit=z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit);
  const offset=z.coerce.number().int().min(0).default(0).parse(req.query.offset);
  const params={limit,offset,like:'%'+search+'%'};
  const where=search?'(o.name ILIKE $3 OR o.slug ILIKE $3 OR u.name ILIKE $3 OR u.email ILIKE $3)':'TRUE';
  const whereCount=search?'(o.name ILIKE $1 OR o.slug ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1)':'TRUE';
  const select=`SELECT o.id,o.name,o.slug,o.created_at::text,
    (SELECT count(*)::int FROM organization_members om WHERE om.org_id=o.id) AS member_count,
    (SELECT count(*)::int FROM farms f WHERE f.organization_id=o.id) AS farm_count,
    (SELECT count(*)::int FROM farms f WHERE f.organization_id=o.id AND NOT f.is_active) AS suspended_count,
    u.id::text AS owner_id,u.name AS owner_name,u.email AS owner_email
    FROM organizations o
    LEFT JOIN organization_members om ON om.org_id=o.id AND om.role='OWNER'
    LEFT JOIN users u ON u.id=om.user_id`;
  const rows=(await db.query(`${select} WHERE ${where} ORDER BY o.created_at DESC LIMIT $1 OFFSET $2`,search?[limit,offset,params.like]:[limit,offset])).rows;
  const total=(await db.query(`SELECT count(*)::int AS total FROM organizations o LEFT JOIN organization_members om ON om.org_id=o.id AND om.role='OWNER' LEFT JOIN users u ON u.id=om.user_id WHERE ${whereCount}`,search?[params.like]:[])).rows[0].total;
  res.json({rows,total,limit,offset});
});

adminRouter.get('/users',async(req,res)=>{
  const search=z.string().max(200).default('').parse(req.query.search);
  const status=z.enum(['all','active','suspended']).default('all').parse(req.query.status);
  const role=z.enum(['all','admin','customer']).default('all').parse(req.query.role);
  const limit=z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit);
  const offset=z.coerce.number().int().min(0).default(0).parse(req.query.offset);
  const params={limit,offset,like:'%'+search+'%'};
  const clauses:string[]=[];
  if(status==='active')clauses.push('u.is_active=TRUE');
  if(status==='suspended')clauses.push('u.is_active=FALSE');
  if(role==='admin')clauses.push('u.is_superadmin=TRUE');
  if(role==='customer')clauses.push('u.is_superadmin=FALSE');
  const filterClause=clauses.join(' AND ');
  const where=search?`(u.name ILIKE $3 OR u.email ILIKE $3)${filterClause?' AND '+filterClause:''}`:filterClause?filterClause:'TRUE';
  const whereCount=search?`(u.name ILIKE $1 OR u.email ILIKE $1)${filterClause?' AND '+filterClause:''}`:filterClause?filterClause:'TRUE';
  const select=`SELECT u.id,u.name,u.email,u.is_active,u.is_superadmin,u.created_at::text,
    (SELECT count(DISTINCT fm2.farm_id)::int FROM farm_members fm2 WHERE fm2.user_id=u.id) AS farm_count,
    (SELECT count(DISTINCT om2.org_id)::int FROM organization_members om2 WHERE om2.user_id=u.id) AS org_count,
    (SELECT max(s.expires_at)::text FROM sessions s WHERE s.user_id=u.id) AS last_seen,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',f.id,'name',f.name,'city',f.city,'currency',f.currency,'is_active',f.is_active,
        'members',(SELECT count(*)::int FROM farm_members fm3 WHERE fm3.farm_id=f.id),
        'staff',(SELECT count(*)::int FROM staff st WHERE st.farm_id=f.id),
        'animals',(SELECT count(*)::int FROM animals a WHERE a.farm_id=f.id),
        'milk_total',(SELECT COALESCE(sum(m.quantity),0)::text FROM milk m WHERE m.farm_id=f.id)
      ) ORDER BY f.name)
      FROM farm_members m3 JOIN farms f ON f.id=m3.farm_id WHERE m3.user_id=u.id
    ),'[]'::jsonb) AS farms
    FROM users u`;
  const rows=(await db.query(`${select} WHERE ${where} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,search?[limit,offset,params.like]:[limit,offset])).rows;
  const total=(await db.query(`SELECT count(*)::int AS total FROM users u WHERE ${whereCount}`,search?[params.like]:[])).rows[0].total;
  res.json({rows,total,limit,offset});
});

adminRouter.post('/farms/:id/status',async(req,res)=>{
  const id=z.uuid().parse(req.params.id);
  const isActive=z.boolean().parse(req.body?.is_active);
  const farm=(await db.query('SELECT name FROM farms WHERE id=$1',[id])).rows[0];
  if(!farm)throw new DomainError(404,'Farm not found');
  await db.query('UPDATE farms SET is_active=$1 WHERE id=$2',[isActive,id]);
  await adminAudit(res.locals.user.id,isActive?'farm.activated':'farm.suspended','farm',id,{name:farm.name});
  res.json({id,is_active:isActive,ok:true});
});

adminRouter.post('/users/:id/status',async(req,res)=>{
  const id=z.uuid().parse(req.params.id);
  const isActive=z.boolean().parse(req.body?.is_active);
  if(id===res.locals.user.id)throw new DomainError(400,'You cannot suspend your own account');
  const user=(await db.query('SELECT name FROM users WHERE id=$1',[id])).rows[0];
  if(!user)throw new DomainError(404,'User not found');
  await db.query('UPDATE users SET is_active=$1 WHERE id=$2',[isActive,id]);
  if(!isActive)await db.query('DELETE FROM sessions WHERE user_id=$1',[id]);
  await adminAudit(res.locals.user.id,isActive?'user.activated':'user.suspended','user',id,{name:user.name});
  res.json({id,is_active:isActive,ok:true});
});

adminRouter.post('/users/:id/superadmin',async(req,res)=>{
  const id=z.uuid().parse(req.params.id);
  const enabled=z.boolean().parse(req.body?.enabled);
  if(enabled)throw new DomainError(400,'The platform has a single designated superadmin account. Only superadmin@dairymonitor.online is the superadmin.');
  if(id===res.locals.user.id)throw new DomainError(400,'You cannot remove your own admin access');
  const user=(await db.query('SELECT name,is_superadmin FROM users WHERE id=$1',[id])).rows[0];
  if(!user)throw new DomainError(404,'User not found');
  await db.query('UPDATE users SET is_superadmin=$1 WHERE id=$2',[enabled,id]);
  await adminAudit(res.locals.user.id,enabled?'admin.granted':'admin.revoked','user',id,{name:user.name});
  res.json({id,is_superadmin:enabled,ok:true});
});

const DEFAULT_SETTINGS:Record<string,unknown>={
  smtp:{host:'',port:587,secure:false,user:'',password:'',passwordSet:false,fromEmail:'',fromName:'DairyMonitor'},
  backup:{enabled:false,hour:3,keep:30},
};

async function getSettings(){const out:Record<string,unknown>={};for(const k of Object.keys(DEFAULT_SETTINGS)){const {rows}=await db.query('SELECT value FROM admin_settings WHERE key=$1',[k]);out[k]=rows[0]?.value??DEFAULT_SETTINGS[k];}
 const s=out.smtp as {password?:string;passwordSet?:boolean};const has=!!s.password;s.password='';s.passwordSet=has;
 return out;}

async function setSetting(key:string,value:unknown){await db.query(`INSERT INTO admin_settings(key,value,updated_at) VALUES($1,$2,now())
  ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,[key,JSON.stringify(value)]);}

const smtpSchema=z.object({
  host:z.string().trim().max(255),port:z.number().int().min(1).max(65535),
  secure:z.boolean(),user:z.string().trim().max(255),password:z.string().max(255).optional().default(''),
  fromEmail:z.string().trim().max(255),fromName:z.string().trim().max(120).default('DairyMonitor'),
});
const backupSchema=z.object({enabled:z.boolean(),hour:z.number().int().min(0).max(23),keep:z.number().int().min(1).max(90)});

adminRouter.get('/settings',async(_req,res)=>{res.json(await getSettings());});

adminRouter.post('/settings',async(req,res)=>{
  const section=z.enum(['smtp','backup']).parse(req.body?.section);
  if(section==='smtp'){
    const value=smtpSchema.parse(req.body?.value);
    const cur=(await getSettings()).smtp as Record<string,unknown>;
    if(!value.password&&cur.passwordSet){value.password=String(cur.password??'');}
    await setSetting('smtp',value);
  }else{
    await setSetting('backup',backupSchema.parse(req.body?.value));
  }
  await adminAudit(res.locals.user.id,'settings.updated','settings',null,{section});
  res.json({ok:true});
});

function testSmtp(host:string,port:number){
  return new Promise<{ok:true;banner:string}>((resolve,reject)=>{
    const sock=net.connect(port,host);
    let buf='';let ehlo=false;let done=false;
    const finish=(ok:boolean,banner:string)=>{if(done)return;done=true;sock.destroy();ok?resolve({ok:true,banner}):reject(new DomainError(400,`SMTP handshake failed: ${banner||'no banner'}`));};
    sock.setTimeout(12000);
    sock.on('data',d=>{buf+=d.toString();if(!ehlo&&/^220/m.test(buf)){ehlo=true;sock.write('EHLO dairymonitor.test\r\n');return;}
      if(ehlo&&buf.includes('250'))finish(true,buf.split('\r\n')[0]?.trim()??'connected');});
    sock.on('timeout',()=>finish(false,'connection timed out'));
    sock.on('error',e=>finish(false,e.message));
  });
}

adminRouter.post('/settings/smtp/test',async(req,res)=>{
  const s=(await getSettings()).smtp as {host:string;port:number};
  if(!s.host)throw new DomainError(400,'SMTP host is not configured');
  const r=await testSmtp(s.host,s.port);
  await adminAudit(res.locals.user.id,'settings.smtp.test','settings',null,{result:'ok'});
  res.json({ok:true,banner:r.banner});
});

function csvValue(v:unknown):string{
  if(v===null||v===undefined)return '';
  let s:string;
  if(v instanceof Date)s=v.toISOString();
  else if(typeof v==='object')s=JSON.stringify(v);
  else s=String(v);
  return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}

const backupDir=path.resolve(process.cwd(),'backups');

adminRouter.post('/backup',async(_req,res)=>{
  mkdirSync(backupDir,{recursive:true});
  const {rows:tables}=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.join(backupDir,`dairymonitor_${stamp}.sql`);
  let totalRows=0;
  const write=new Promise<void>((resolve,reject)=>{
    const out=createWriteStream(file);out.on('error',reject);
    out.write('-- DairyMonitor database backup\n');
    out.write(`-- Generated: ${new Date().toISOString()}\n-- Database: ${new URL(process.env.DATABASE_URL??'').pathname.replace('/','')}\n`);
    (async()=>{
      for(const t of tables){
        const name=t.table_name;
        const {rows:cols}=await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,[name]);
        const colList=cols.map((c:Record<string,string>)=>`"${c.column_name}"`).join(', ');
        const data=(await db.query(`SELECT * FROM "${name}"`)).rows;
        totalRows+=data.length;
        out.write(`\n-- Table: ${name} (${data.length} rows)\n`);
        out.write(`COPY "${name}" (${colList}) FROM stdin WITH (FORMAT csv);\n`);
        for(const row of data){out.write(cols.map((c:Record<string,string>)=>csvValue(row[c.column_name])).join(',')+'\n');}
        out.write('\\.\n');
      }
      out.end('-- End of backup\n',resolve);
    })().catch(reject);
  });
  await write;
  await adminAudit(res.locals.user.id,'backup.created','backup',null,{file:path.basename(file),tables:tables.length,rows:totalRows});
  res.json({ok:true,file:path.basename(file),tables:tables.length,rows:totalRows,size:statSync(file).size});
});

adminRouter.get('/backups',async(_req,res)=>{
  mkdirSync(backupDir,{recursive:true});
  const files=readdirSync(backupDir).filter(f=>/^dairymonitor_.+\.sql$/.test(f))
    .map(f=>{const st=statSync(path.join(backupDir,f));return {file:f,size:st.size,created:st.mtime.toISOString()};})
    .sort((a,b)=>b.created.localeCompare(a.created));
  res.json({files});
});

adminRouter.get('/backups/:file',async(req,res)=>{
  const file=z.string().regex(/^dairymonitor_[A-Za-z0-9.-]+\.sql$/).parse(req.params.file);
  const p=path.join(backupDir,file);
  res.download(p,file,{headers:{'content-type':'application/sql'}});
});

adminRouter.get('/activity',async(req,res)=>{
  const limit=z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit);
  const {rows}=await db.query(`SELECT a.id,a.action,a.record_type,a.record_id,a.detail::text,a.created_at::text,
    u.name AS admin_name FROM admin_audit_logs a LEFT JOIN users u ON u.id=a.admin_user_id
    ORDER BY a.created_at DESC LIMIT $1`,[limit]);
  res.json({rows});
});

adminRouter.get('/notifications',async(req,res)=>{
  const limit=z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit);
  const {rows}=await db.query(`SELECT id::text,type,target_id::text,target_name,detail::text,created_at::text
    FROM platform_notifications ORDER BY created_at DESC LIMIT $1`,[limit]);
  res.json({rows});
});

adminRouter.get('/search',async(req,res)=>{
  const q=(req.query.q as string??'').trim();
  if(q.length<2){res.json({users:[],farms:[]});return;}
  const like=`%${q}%`;
  const users=(await db.query(`SELECT id::text,name,email,is_active,is_superadmin FROM users
    WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY name LIMIT 6`,[like])).rows;
  const farms=(await db.query(`SELECT f.id::text,f.name,f.city,f.country,f.is_active,
    own.owner_name,own.owner_email FROM farms f
    LEFT JOIN LATERAL (SELECT u2.name AS owner_name,u2.email AS owner_email FROM farm_members m2
      JOIN users u2 ON u2.id=m2.user_id WHERE m2.farm_id=f.id ORDER BY m2.user_id LIMIT 1) own ON TRUE
    WHERE f.name ILIKE $1 OR f.city ILIKE $1 OR own.owner_name ILIKE $1 ORDER BY f.name LIMIT 6`,[like])).rows;
  res.json({users,farms});
});