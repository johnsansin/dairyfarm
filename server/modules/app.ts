import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import nodemailer from 'nodemailer';
import {db} from '../db';
import {DomainError} from './operations';
import {getModule} from '../../shared/modules';
import {workflows} from './workflows';
import {accessFor,canAccess} from './access';
export const appRouter=Router({mergeParams:true});

appRouter.use(async(req,res,next)=>{
 const farmId=(req.params as Record<string,string>).farmId;
 if(!z.uuid().safeParse(farmId).success)throw new DomainError(404,'Farm not found');
 const {rows}=await db.query('SELECT f.*,m.role,m.role_id FROM farms f JOIN farm_members m ON m.farm_id=f.id WHERE f.id=$1 AND m.user_id=$2',[farmId,res.locals.user.id]);
 if(!rows[0])throw new DomainError(404,'Farm not found');
 const member=await accessFor(farmId,res.locals.user.id);if(!member)throw new DomainError(404,'Farm not found');
 const ownNotification=req.method==='POST'&&/^\/notifications\/(read-all|[0-9a-f-]+\/read)$/.test(req.path);
 const delegatedSettings=req.path.startsWith('/settings')&&canAccess(member,'settings',true);
 if(!['GET','HEAD'].includes(req.method)&&!ownNotification&&rows[0].role!=='OWNER'&&!delegatedSettings&&!(req.path.startsWith('/stock/')&&canAccess(member,'inventory',true)))throw new DomainError(403,'Only farm owners can change records');
 res.locals.farm={id:rows[0].id,...member};next();
});

appRouter.use(workflows);
// ---- Notifications ----
appRouter.get('/notifications',async(req,res)=>{
 const farm=res.locals.farm.id,user=res.locals.user.id;
 const events:any[]=[];
 if(canAccess(res.locals.farm,'tasks'))events.push(...(await db.query("SELECT id,title,date::text AS due,'tasks' AS module FROM tasks WHERE farm_id=$1 AND status NOT IN ('Completed','Verified') AND date<=CURRENT_DATE+7 LIMIT 30",[farm])).rows);
 if(canAccess(res.locals.farm,'vaccinations'))events.push(...(await db.query("SELECT v.id,v.vaccine||' — '||concat_ws(' — ',a.tag,NULLIF(a.name,'')) AS title,v.next_due::text AS due,'vaccinations' AS module FROM vaccinations v JOIN animals a ON a.farm_id=v.farm_id AND a.id=v.animal_id WHERE v.farm_id=$1 AND v.next_due<=CURRENT_DATE+7 LIMIT 30",[farm])).rows);
 if(canAccess(res.locals.farm,'inventory'))events.push(...(await db.query("SELECT id,'Low stock: '||name AS title,CURRENT_DATE::text AS due,'inventory' AS module FROM inventory WHERE farm_id=$1 AND stock_quantity<=minimum_stock LIMIT 30",[farm])).rows);
 for(const e of events)await db.query("INSERT INTO notifications(id,farm_id,user_id,type,title,body,link,event_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(farm_id,user_id,event_key) WHERE event_key IS NOT NULL DO NOTHING",[randomUUID(),farm,user,e.module,e.title,'Due / checked: '+e.due,'/dashboard?farm='+farm+'&tab='+e.module,e.module+':'+e.id+':'+e.due]);
 const limit=z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
 const {rows}=await db.query('SELECT id,type,title,body,link,is_read,created_at FROM notifications WHERE farm_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3',[res.locals.farm.id,res.locals.user.id,limit]);
 const unread=(await db.query('SELECT count(*)::int AS c FROM notifications WHERE farm_id=$1 AND user_id=$2 AND is_read=false',[res.locals.farm.id,res.locals.user.id])).rows[0].c;
 res.json({rows,unread});
});
appRouter.post('/notifications/:id/read',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);
 const r=await db.query('UPDATE notifications SET is_read=true WHERE id=$1 AND farm_id=$2 AND user_id=$3 RETURNING id',[id,res.locals.farm.id,res.locals.user.id]);
 if(!r.rowCount)throw new DomainError(404,'Notification not found');
 res.json({ok:true});
});
appRouter.post('/notifications/read-all',async(_req,res)=>{
 await db.query('UPDATE notifications SET is_read=true WHERE farm_id=$1 AND user_id=$2',[res.locals.farm.id,res.locals.user.id]);
 res.json({ok:true});
});

// ---- Roles & permissions ----
const roleInput=z.object({name:z.string().trim().min(1).max(80),description:z.string().trim().max(300).optional().default(''),permissions:z.array(z.object({module:z.string().refine(v=>Boolean(getModule(v))||v==='settings','Unknown module'),access:z.enum(['read','write','none'])})).default([])}).refine(v=>new Set(v.permissions.map(p=>p.module)).size===v.permissions.length,'Duplicate module permissions');
appRouter.get('/roles',async(_req,res)=>{
 const roles=(await db.query('SELECT id,name,description,is_system FROM roles WHERE farm_id=$1 ORDER BY created_at',[res.locals.farm.id])).rows;
 const perms=(await db.query('SELECT role_id,module,access FROM permissions WHERE farm_id=$1',[res.locals.farm.id])).rows;
 res.json({roles,permissions:perms});
});
appRouter.post('/roles',async(req,res)=>{
 const input=roleInput.parse(req.body);const roleId=randomUUID();const client=await db.connect();
 try{await client.query('BEGIN');
  await client.query('INSERT INTO roles(id,farm_id,name,description) VALUES($1,$2,$3,$4)',[roleId,res.locals.farm.id,input.name,input.description]);
  for(const p of input.permissions)await client.query('INSERT INTO permissions(id,farm_id,role_id,module,access) VALUES($1,$2,$3,$4,$5)',[randomUUID(),res.locals.farm.id,roleId,p.module,p.access]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 res.status(201).json({id:roleId,name:input.name,description:input.description,permissions:input.permissions});
});
appRouter.put('/roles/:id',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);const input=roleInput.parse(req.body);
 const existing=await db.query('SELECT is_system FROM roles WHERE id=$1 AND farm_id=$2',[id,res.locals.farm.id]);
 if(!existing.rowCount)throw new DomainError(404,'Role not found');
 const client=await db.connect();
 try{await client.query('BEGIN');
  await client.query('UPDATE roles SET name=$1,description=$2 WHERE id=$3 AND farm_id=$4',[input.name,input.description,id,res.locals.farm.id]);
  await client.query('DELETE FROM permissions WHERE role_id=$1 AND farm_id=$2',[id,res.locals.farm.id]);
  for(const p of input.permissions)await client.query('INSERT INTO permissions(id,farm_id,role_id,module,access) VALUES($1,$2,$3,$4,$5)',[randomUUID(),res.locals.farm.id,id,p.module,p.access]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 res.json({ok:true});
});

// ---- Team management (add user by email + role) ----
const memberRoleInput=z.object({role:z.enum(['OWNER','VIEWER']),roleId:z.uuid().optional().nullable()}).refine(v=>!v.roleId||v.role==='VIEWER','Custom roles cannot grant owner access');
const memberInput=memberRoleInput.safeExtend({email:z.string().trim().toLowerCase().email()});
async function validateMemberRole(client:import('pg').PoolClient,farm:string,roleId?:string|null){
 if(roleId&&!(await client.query('SELECT 1 FROM roles WHERE farm_id=$1 AND id=$2',[farm,roleId])).rowCount)throw new DomainError(400,'Role does not belong to this farm');
}
appRouter.get('/team',async(_req,res)=>{
 const {rows}=await db.query('SELECT u.id,u.name,u.email,m.role,m.role_id,m.status,r.name AS role_name FROM farm_members m JOIN users u ON u.id=m.user_id LEFT JOIN roles r ON r.id=m.role_id WHERE m.farm_id=$1',[res.locals.farm.id]);
 res.json(rows);
});
appRouter.post('/team',async(req,res)=>{
 const input=memberInput.parse(req.body);
 const user=(await db.query('SELECT id FROM users WHERE email=$1',[input.email])).rows[0];
 if(!user)throw new DomainError(404,'No account found with this email. Ask them to register first.');
 const existing=await db.query('SELECT 1 FROM farm_members WHERE farm_id=$1 AND user_id=$2',[res.locals.farm.id,user.id]);
 if(existing.rowCount)throw new DomainError(409,'This user is already a member of the farm.');
 const client=await db.connect();
 try{await client.query('BEGIN');
 const farm=(await client.query('SELECT name FROM farms WHERE id=$1 FOR UPDATE',[res.locals.farm.id])).rows[0];
 const actor=(await client.query('SELECT role FROM farm_members WHERE farm_id=$1 AND user_id=$2',[res.locals.farm.id,res.locals.user.id])).rows[0];
 if(actor?.role!=='OWNER')throw new DomainError(403,'Only farm owners can change members');
 await validateMemberRole(client,res.locals.farm.id,input.roleId);
 await client.query('INSERT INTO farm_members(farm_id,user_id,role,role_id) VALUES($1,$2,$3,$4)',[res.locals.farm.id,user.id,input.role,input.roleId??null]);
 await client.query('INSERT INTO notifications(id,farm_id,user_id,type,title,body,link) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),res.locals.farm.id,user.id,'team',`You were added to ${farm.name}`,'You can now access this farm workspace.',`/dashboard?farm=${res.locals.farm.id}`]);
 await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),res.locals.farm.id,res.locals.user.id,'team.added',user.id,JSON.stringify(input)]);
 await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 res.status(201).json({ok:true});
});

// ---- Settings ----
appRouter.route('/team/:id').put(changeMember).delete(changeMember);
async function changeMember(req:import('express').Request,res:import('express').Response){
 const id=z.uuid().parse(req.params.id);const farm=res.locals.farm.id;
 const input=req.method==='PUT'?memberRoleInput.parse(req.body):null;
 const client=await db.connect();
 try{await client.query('BEGIN');
 // Serialize membership changes so concurrent removals cannot remove every owner.
 await client.query('SELECT id FROM farms WHERE id=$1 FOR UPDATE',[farm]);
 const actor=(await client.query('SELECT role FROM farm_members WHERE farm_id=$1 AND user_id=$2',[farm,res.locals.user.id])).rows[0];
 if(actor?.role!=='OWNER')throw new DomainError(403,'Only farm owners can change members');
 const old=(await client.query('SELECT role,role_id FROM farm_members WHERE farm_id=$1 AND user_id=$2',[farm,id])).rows[0];
 if(!old)throw new DomainError(404,'Member not found');
 if(old.role==='OWNER'&&input?.role!=='OWNER'&&(await client.query("SELECT 1 FROM farm_members WHERE farm_id=$1 AND role='OWNER' AND user_id<>$2",[farm,id])).rowCount===0)throw new DomainError(409,'The farm must have at least one owner');
 if(input){await validateMemberRole(client,farm,input.roleId);await client.query('UPDATE farm_members SET role=$3,role_id=$4 WHERE farm_id=$1 AND user_id=$2',[farm,id,input.role,input.roleId??null]);}
 else await client.query('DELETE FROM farm_members WHERE farm_id=$1 AND user_id=$2',[farm,id]);
 await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,old_value,new_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),farm,res.locals.user.id,input?'team.updated':'team.removed',id,JSON.stringify(old),input?JSON.stringify(input):null]);
 await client.query('COMMIT');res.json({ok:true});
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

appRouter.get('/settings',async(_req,res)=>{
 if(!canAccess(res.locals.farm,'settings'))throw new DomainError(403,'Settings access is not enabled for your role');
 const {rows}=await db.query('SELECT json FROM farm_settings WHERE farm_id=$1',[res.locals.farm.id]);
 res.json(rows[0]?.json??{});
});
appRouter.put('/settings',async(req,res)=>{
 if(!canAccess(res.locals.farm,'settings',true))throw new DomainError(403,'Settings write access is not enabled for your role');
 const body=req.body??{};
 await db.query(`INSERT INTO farm_settings(farm_id,json) VALUES($1,$2) ON CONFLICT (farm_id) DO UPDATE SET json=EXCLUDED.json`,[res.locals.farm.id,JSON.stringify(body)]);
 res.json({ok:true});
});
appRouter.post('/settings/test-email',async(req,res)=>{
 if(!canAccess(res.locals.farm,'settings',true))throw new DomainError(403,'Settings write access is not enabled for your role');
 const recipient=z.email().parse(req.body?.recipient);const saved=(await db.query('SELECT json FROM farm_settings WHERE farm_id=$1',[res.locals.farm.id])).rows[0]?.json??{};
 const cfg={...saved,...req.body?.settings};const input=z.object({smtpHost:z.string().trim().min(1),smtpPort:z.coerce.number().int().min(1).max(65535),smtpSecurity:z.enum(['STARTTLS','TLS','None']),smtpUsername:z.string().default(''),smtpPassword:z.string().default(''),smtpFromName:z.string().trim().min(1),smtpFromEmail:z.email()}).parse(cfg);
 const transport=nodemailer.createTransport({host:input.smtpHost,port:input.smtpPort,secure:input.smtpSecurity==='TLS',requireTLS:input.smtpSecurity==='STARTTLS',auth:input.smtpUsername?{user:input.smtpUsername,pass:input.smtpPassword}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
 await transport.verify();await transport.sendMail({from:{name:input.smtpFromName,address:input.smtpFromEmail},to:recipient,subject:'DairyMonitor SMTP test',text:'Your DairyMonitor email delivery configuration is working.'});
 res.json({ok:true,message:'Test email sent successfully.'});
});

appRouter.get('/calendar',async(req,res)=>{
 const from=z.iso.date().parse(req.query.from),to=z.iso.date().parse(req.query.to);if(from>to)throw new DomainError(400,'Invalid date range');
 const farm=res.locals.farm.id;const rows:any[]=[];
 if(canAccess(res.locals.farm,'tasks'))rows.push(...(await db.query("SELECT id,date::text,title,priority,status,'Task' AS type FROM tasks WHERE farm_id=$1 AND date BETWEEN $2 AND $3",[farm,from,to])).rows);
 if(canAccess(res.locals.farm,'vaccinations'))rows.push(...(await db.query("SELECT v.id,v.next_due::text AS date,v.vaccine||' · '||concat_ws(' — ',a.tag,NULLIF(a.name,'')) AS title,'Vaccination' AS type FROM vaccinations v JOIN animals a ON a.farm_id=v.farm_id AND a.id=v.animal_id WHERE v.farm_id=$1 AND v.next_due BETWEEN $2 AND $3",[farm,from,to])).rows);
 if(canAccess(res.locals.farm,'breeding'))rows.push(...(await db.query("SELECT b.id,b.expected_date::text AS date,b.event||' · '||concat_ws(' — ',a.tag,NULLIF(a.name,'')) AS title,'Breeding' AS type FROM breeding b JOIN animals a ON a.farm_id=b.farm_id AND a.id=b.animal_id WHERE b.farm_id=$1 AND b.expected_date BETWEEN $2 AND $3",[farm,from,to])).rows);
 if(canAccess(res.locals.farm,'health'))rows.push(...(await db.query("SELECT h.id,h.follow_up::text AS date,'Follow-up · '||concat_ws(' — ',a.tag,NULLIF(a.name,'')) AS title,'Health' AS type FROM health h JOIN animals a ON a.farm_id=h.farm_id AND a.id=h.animal_id WHERE h.farm_id=$1 AND h.follow_up BETWEEN $2 AND $3",[farm,from,to])).rows);
 res.json(rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))));
});
appRouter.patch('/calendar/tasks/:id',async(req,res)=>{
 if(!canAccess(res.locals.farm,'tasks',true))throw new DomainError(403,'Task write access is required');
 const id=z.uuid().parse(req.params.id);const input=z.object({date:z.iso.date(),title:z.string().trim().min(1).max(200).optional(),priority:z.enum(['Normal','High','Urgent']).optional(),status:z.enum(['Assigned','In progress','Completed','Verified']).optional()}).parse(req.body);
 const old=(await db.query('SELECT * FROM tasks WHERE farm_id=$1 AND id=$2',[res.locals.farm.id,id])).rows[0];if(!old)throw new DomainError(404,'Task not found');
 const row=(await db.query('UPDATE tasks SET date=$3,title=COALESCE($4,title),priority=COALESCE($5,priority),status=COALESCE($6,status),version=version+1 WHERE farm_id=$1 AND id=$2 RETURNING id,date::text,title,priority,status,version',[res.locals.farm.id,id,input.date,input.title??null,input.priority??null,input.status??null])).rows[0];
 await db.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,old_value,new_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),res.locals.farm.id,res.locals.user.id,'task.calendar_updated',id,JSON.stringify(old),JSON.stringify(row)]);res.json(row);
});

// ---- Accounting: Chart of Accounts ----
const coaInput=z.object({code:z.string().trim().min(1).max(20),name:z.string().trim().min(1).max(120),account_type:z.enum(['Asset','Liability','Equity','Income','Expense']),category:z.string().trim().max(80).optional().default(''),is_active:z.boolean().optional().default(true)});
appRouter.get('/coa',async(_req,res)=>{
 const {rows}=await db.query('SELECT id,code,name,account_type,category,is_active,version FROM chart_of_accounts WHERE farm_id=$1 ORDER BY code',[res.locals.farm.id]);
 res.json(rows);
});
appRouter.post('/coa',async(req,res)=>{
 const input=coaInput.parse(req.body);const id=randomUUID();
 try{const {rows}=await db.query('INSERT INTO chart_of_accounts(id,farm_id,code,name,account_type,category,is_active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id,res.locals.farm.id,input.code,input.name,input.account_type,input.category,input.is_active]);res.status(201).json(rows[0]);}
 catch(e){if((e as {code:string}).code==='23505')throw new DomainError(409,'Account code already exists');throw e;}
});
appRouter.put('/coa/:id',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);const input=coaInput.parse(req.body);
 const {rows}=await db.query('UPDATE chart_of_accounts SET code=$1,name=$2,account_type=$3,category=$4,is_active=$5,version=version+1 WHERE id=$6 AND farm_id=$7 RETURNING *',[input.code,input.name,input.account_type,input.category,input.is_active,id,res.locals.farm.id]);
 if(!rows[0])throw new DomainError(404,'Account not found');res.json(rows[0]);
});

// ---- Accounting: Journal entries ----
const journalInput=z.object({account_id:z.uuid(),entry_date:z.iso.date(),entry_type:z.enum(['General','MilkSale','Expense','Payroll','Distribution','Transfer']).optional().default('General'),description:z.string().trim().max(300).optional().default(''),debit:z.number().min(0),credit:z.number().min(0),reference:z.string().trim().max(60).optional().default('')}).refine(v=>v.debit>0||v.credit>0,{message:'Entry must have a debit or credit'});
appRouter.get('/journal',async(req,res)=>{
 const {rows}=await db.query('SELECT j.*,a.name AS account_name,a.code AS account_code,a.account_type FROM journal_entries j JOIN chart_of_accounts a ON a.id=j.account_id WHERE j.farm_id=$1 ORDER BY j.entry_date DESC,j.created_at DESC LIMIT 500',[res.locals.farm.id]);
 res.json(rows);
});
appRouter.post('/journal',async(req,res)=>{
 const input=journalInput.parse(req.body);
 const acct=await db.query('SELECT 1 FROM chart_of_accounts WHERE id=$1 AND farm_id=$2',[input.account_id,res.locals.farm.id]);
 if(!acct.rowCount)throw new DomainError(400,'Account does not belong to this farm');
 const id=randomUUID();
 const {rows}=await db.query('INSERT INTO journal_entries(id,farm_id,account_id,entry_date,entry_type,description,debit,credit,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[id,res.locals.farm.id,input.account_id,input.entry_date,input.entry_type,input.description,input.debit,input.credit,input.reference]);
 res.status(201).json(rows[0]);
});

// ---- Accounting: Financial report (trial balance / statement) ----
appRouter.get('/ledger',async(req,res)=>{
 const {rows}=await db.query(`SELECT a.id,a.code,a.name,a.account_type,
  COALESCE(sum(j.debit),0)::text AS total_debit, COALESCE(sum(j.credit),0)::text AS total_credit,
  (COALESCE(sum(j.debit),0)-COALESCE(sum(j.credit),0))::text AS balance
  FROM chart_of_accounts a LEFT JOIN journal_entries j ON j.account_id=a.id AND j.farm_id=$1
  WHERE a.farm_id=$1 GROUP BY a.id,a.code,a.name,a.account_type ORDER BY a.code`,[res.locals.farm.id]);
 res.json(rows);
});
appRouter.get('/reports/financial',async(req,res)=>{
 const totals=await db.query(`SELECT
  (SELECT COALESCE(sum(debit-credit),0)::text FROM journal_entries WHERE farm_id=$1 AND entry_type='MilkSale') AS milk_sale,
  (SELECT COALESCE(sum(debit-credit),0)::text FROM journal_entries WHERE farm_id=$1 AND entry_type='Expense') AS expenses,
  (SELECT COALESCE(sum(debit+credit),0)::text FROM journal_entries WHERE farm_id=$1) AS total_entries`,[res.locals.farm.id]);
 res.json(totals.rows[0]);
});

// ---- Animal / Staff photo ----
const photoInput=z.object({photo:z.string().max(2_800_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)});
appRouter.post('/animals/:id/photo',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);const input=photoInput.parse(req.body);
 const {rows}=await db.query('UPDATE animals SET photo=$1 WHERE id=$2 AND farm_id=$3 RETURNING id',[input.photo,id,res.locals.farm.id]);
 if(!rows[0])throw new DomainError(404,'Animal not found');
 res.json({ok:true});
});
appRouter.post('/staff/:id/photo',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);const input=photoInput.parse(req.body);
 const {rows}=await db.query('UPDATE staff SET photo=$1 WHERE id=$2 AND farm_id=$3 RETURNING id',[input.photo,id,res.locals.farm.id]);
 if(!rows[0])throw new DomainError(404,'Staff not found');
 res.json({ok:true});
});
