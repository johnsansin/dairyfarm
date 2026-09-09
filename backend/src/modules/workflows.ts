import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '../db';
import {modules,getModule} from '../../shared/modules';
import {DomainError} from './operations';
import {accessFor,canAccess} from './access';
import {stockChange} from './stock';
export const workflows=Router({mergeParams:true});
workflows.get('/access',async(_req,res)=>res.json(res.locals.farm));
workflows.get('/dropdowns',async(_req,res)=>{
 const overrides=(await db.query('SELECT module,field,values FROM dropdown_options WHERE farm_id=$1',[res.locals.farm.id])).rows;
 res.json(modules.flatMap(m=>m.fields.filter(f=>f.type==='select').map(f=>({module:m.key,moduleName:m.en,field:f.key,name:f.en,defaults:f.options,values:overrides.find(o=>o.module===m.key&&o.field===f.key)?.values??f.options}))));
});
workflows.put('/dropdowns/:module/:field',async(req,res)=>{
 const m=getModule(String(req.params.module)),f=m?.fields.find(f=>f.key===req.params.field&&f.type==='select');
 if(!m||!f)throw new DomainError(404,'Dropdown not found');
 const values=z.array(z.string().trim().min(1).max(100)).min(1).max(100).refine(v=>new Set(v).size===v.length,'Duplicate choices').parse(req.body.values);
 // Keep workflow states available; custom choices may be added without redefining them.
 const editableDefaults=m.key==='inventory'&&f.key==='unit';
 if(!editableDefaults&&!f.options?.every(o=>values.includes(o)))throw new DomainError(400,'Built-in workflow choices must remain available');
 await db.query('INSERT INTO dropdown_options(farm_id,module,field,values) VALUES($1,$2,$3,$4) ON CONFLICT(farm_id,module,field) DO UPDATE SET values=EXCLUDED.values',[res.locals.farm.id,m.key,f.key,JSON.stringify(values)]);
 res.json({ok:true});
});
const transactionBase=z.object({quantity:z.coerce.number().positive().max(999999999),payment_status:z.enum(['Unpaid','Partially paid','Paid']),reference:z.string().trim().max(100).optional().default(''),notes:z.string().trim().max(2000).optional().default('')});
workflows.get('/options/suppliers',async(_req,res)=>res.json((await db.query('SELECT id,name FROM suppliers WHERE farm_id=$1 ORDER BY name LIMIT 500',[res.locals.farm.id])).rows));
workflows.get('/animal-costs',async(req,res)=>{if(!canAccess(res.locals.farm,'animals'))throw new DomainError(403,'Animals access required');const animal=z.uuid().parse(req.query.animal_id);res.json((await db.query('SELECT c.*,i.name AS item_name FROM animal_cost_entries c LEFT JOIN inventory i ON i.farm_id=c.farm_id AND i.id=c.item_id WHERE c.farm_id=$1 AND c.animal_id=$2 ORDER BY c.entry_date DESC,c.created_at DESC',[res.locals.farm.id,animal])).rows)});
workflows.post('/animal-costs',async(req,res)=>{if(!canAccess(res.locals.farm,'animals',true))throw new DomainError(403,'Animals write access required');const input=z.object({animal_id:z.uuid(),item_id:z.uuid().nullable().optional(),entry_date:z.iso.date(),category:z.enum(['Feed','Vaccination','Treatment','Breeding','Other']),description:z.string().trim().min(2).max(200),quantity:z.coerce.number().positive(),unit:z.string().trim().min(1).max(40),unit_cost:z.coerce.number().nonnegative(),notes:z.string().trim().max(2000).optional().default('')}).parse(req.body),farm=res.locals.farm.id,client=await db.connect(),id=randomUUID();try{await client.query('BEGIN');if(!(await client.query('SELECT 1 FROM animals WHERE farm_id=$1 AND id=$2',[farm,input.animal_id])).rowCount)throw new DomainError(400,'Animal does not belong to this farm');if(input.item_id)await stockChange(client,farm,res.locals.user.id,input.item_id,'-'+input.quantity,input.entry_date,input.description,'0','animal_cost',id);const row=(await client.query('INSERT INTO animal_cost_entries(id,farm_id,animal_id,item_id,entry_date,category,description,quantity,unit,unit_cost,notes,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[id,farm,input.animal_id,input.item_id||null,input.entry_date,input.category,input.description,input.quantity,input.unit,input.unit_cost,input.notes,res.locals.user.id])).rows[0];await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,res.locals.user.id,'animal_cost.created',id,JSON.stringify(row)]);await client.query('COMMIT');res.status(201).json(row)}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}});
workflows.get('/milk-sales',async(_req,res)=>{if(!canAccess(res.locals.farm,'buyers'))throw new DomainError(403,'Milk buyers access required');res.json((await db.query('SELECT s.*,b.name AS buyer_name FROM milk_sales s JOIN buyers b ON b.farm_id=s.farm_id AND b.id=s.buyer_id WHERE s.farm_id=$1 ORDER BY s.sale_date DESC,s.created_at DESC LIMIT 500',[res.locals.farm.id])).rows)});
workflows.post('/milk-sales',async(req,res)=>{if(!canAccess(res.locals.farm,'buyers',true))throw new DomainError(403,'Milk buyers write access required');const input=transactionBase.extend({buyer_id:z.uuid(),sale_date:z.iso.date(),rate:z.coerce.number().nonnegative().max(999999999)}).parse(req.body);const farm=res.locals.farm.id;if(input.sale_date>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}))throw new DomainError(400,'Sale date cannot be in the future');if(!(await db.query('SELECT 1 FROM buyers WHERE farm_id=$1 AND id=$2',[farm,input.buyer_id])).rowCount)throw new DomainError(400,'Buyer does not belong to this farm');const id=randomUUID(),client=await db.connect();try{await client.query('BEGIN');const row=(await client.query('INSERT INTO milk_sales(id,farm_id,buyer_id,sale_date,quantity,rate,payment_status,reference,notes,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[id,farm,input.buyer_id,input.sale_date,input.quantity,input.rate,input.payment_status,input.reference,input.notes,res.locals.user.id])).rows[0];let account=(await client.query("SELECT id FROM chart_of_accounts WHERE farm_id=$1 AND code='4000'",[farm])).rows[0];if(!account){account=(await client.query("INSERT INTO chart_of_accounts(id,farm_id,code,name,account_type,category) VALUES($1,$2,'4000','Milk sales','Income','Sales') RETURNING id",[randomUUID(),farm])).rows[0]}await client.query("INSERT INTO journal_entries(id,farm_id,account_id,entry_date,entry_type,description,debit,credit,reference) VALUES($1,$2,$3,$4,'MilkSale',$5,$6,0,$7)",[randomUUID(),farm,account.id,input.sale_date,'Milk sale',row.total,input.reference||id]);await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,res.locals.user.id,'milk_sale.created',id,JSON.stringify(row)]);await client.query('COMMIT');res.status(201).json(row)}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}});
workflows.get('/inventory-purchases',async(_req,res)=>{if(!canAccess(res.locals.farm,'inventory'))throw new DomainError(403,'Inventory access required');res.json((await db.query('SELECT p.*,i.name AS item_name,i.unit,s.name AS supplier_name FROM inventory_purchases p JOIN inventory i ON i.farm_id=p.farm_id AND i.id=p.item_id JOIN suppliers s ON s.farm_id=p.farm_id AND s.id=p.supplier_id WHERE p.farm_id=$1 ORDER BY p.purchase_date DESC,p.created_at DESC LIMIT 500',[res.locals.farm.id])).rows)});
workflows.post('/inventory-purchases',async(req,res)=>{if(!canAccess(res.locals.farm,'inventory',true))throw new DomainError(403,'Inventory write access required');const input=transactionBase.extend({item_id:z.uuid(),supplier_id:z.uuid(),purchase_date:z.iso.date(),unit_cost:z.coerce.number().nonnegative().max(999999999)}).parse(req.body);const farm=res.locals.farm.id;if(input.purchase_date>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}))throw new DomainError(400,'Purchase date cannot be in the future');const client=await db.connect(),id=randomUUID();try{await client.query('BEGIN');if(!(await client.query('SELECT 1 FROM suppliers WHERE farm_id=$1 AND id=$2',[farm,input.supplier_id])).rowCount)throw new DomainError(400,'Supplier does not belong to this farm');await stockChange(client,farm,res.locals.user.id,input.item_id,String(input.quantity),input.purchase_date,'Inventory purchase',String(input.unit_cost),'inventory_purchase',id);const row=(await client.query('INSERT INTO inventory_purchases(id,farm_id,item_id,supplier_id,purchase_date,quantity,unit_cost,payment_status,reference,notes,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[id,farm,input.item_id,input.supplier_id,input.purchase_date,input.quantity,input.unit_cost,input.payment_status,input.reference,input.notes,res.locals.user.id])).rows[0];let account=(await client.query("SELECT id FROM chart_of_accounts WHERE farm_id=$1 AND code='5000'",[farm])).rows[0];if(!account){account=(await client.query("INSERT INTO chart_of_accounts(id,farm_id,code,name,account_type,category) VALUES($1,$2,'5000','Inventory purchases','Expense','Purchases') RETURNING id",[randomUUID(),farm])).rows[0]}await client.query("INSERT INTO journal_entries(id,farm_id,account_id,entry_date,entry_type,description,debit,credit,reference) VALUES($1,$2,$3,$4,'Expense',$5,$6,0,$7)",[randomUUID(),farm,account.id,input.purchase_date,'Inventory purchase',row.total,input.reference||id]);await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,res.locals.user.id,'inventory_purchase.created',id,JSON.stringify(row)]);await client.query('COMMIT');res.status(201).json(row)}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}});
workflows.get('/stock',async(req,res)=>{
 if(!canAccess(res.locals.farm,'inventory'))throw new DomainError(403,'Inventory access required');
 res.json((await db.query('SELECT id,name,category,unit,stock_quantity,minimum_stock FROM inventory WHERE farm_id=$1 ORDER BY name',[res.locals.farm.id])).rows);
});
workflows.get('/stock/:id/movements',async(req,res)=>{
 if(!canAccess(res.locals.farm,'inventory'))throw new DomainError(403,'Inventory access required');
 const id=z.uuid().parse(req.params.id);
 res.json((await db.query('SELECT * FROM stock_movements WHERE farm_id=$1 AND item_id=$2 ORDER BY created_at DESC LIMIT 500',[res.locals.farm.id,id])).rows);
});
workflows.post('/stock/:id/movements',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);
 const data=z.object({direction:z.enum(['add','consume']),quantity:z.coerce.number().positive().max(999999999).refine(v=>Math.round(v*1000)===v*1000),unit_cost:z.coerce.number().nonnegative().max(999999999).default(0),date:z.iso.date(),reason:z.string().trim().min(2).max(300)}).parse(req.body);
 if(data.date>new Date().toISOString().slice(0,10))throw new DomainError(400,'Stock movement cannot be in the future');
 const client=await db.connect();try{await client.query('BEGIN');
 const row=await stockChange(client,res.locals.farm.id,res.locals.user.id,id,(data.direction==='consume'?'-':'')+data.quantity,data.date,data.reason,String(data.unit_cost));
 await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),res.locals.farm.id,res.locals.user.id,'stock.moved',id,JSON.stringify(data)]);
 await client.query('COMMIT');res.status(201).json(row);
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});
workflows.get('/team/staff',async(_req,res)=>{
 const rows=(await db.query('SELECT s.*,r.name AS role_name,u.email AS account_email FROM staff s LEFT JOIN roles r ON r.id=s.role_id AND r.farm_id=s.farm_id LEFT JOIN users u ON u.id=s.user_id WHERE s.farm_id=$1 ORDER BY s.name',[res.locals.farm.id])).rows;res.json(rows);
});
workflows.put('/team/staff/:id',async(req,res)=>{
 const id=z.uuid().parse(req.params.id);
 const data=z.object({roleId:z.uuid().nullable(),email:z.union([z.email(),z.literal('')]).optional()}).parse(req.body);
 const farm=res.locals.farm.id,client=await db.connect();
 try{await client.query('BEGIN');await client.query('SELECT id FROM farms WHERE id=$1 FOR UPDATE',[farm]);
 const staff=(await client.query('SELECT * FROM staff WHERE farm_id=$1 AND id=$2 FOR UPDATE',[farm,id])).rows[0];
 if(!staff)throw new DomainError(404,'Staff not found');
 if(data.roleId&&!(await client.query('SELECT 1 FROM roles WHERE farm_id=$1 AND id=$2',[farm,data.roleId])).rowCount)throw new DomainError(400,'Role belongs to another farm');
 let userId=staff.user_id;
 if(data.email){const user=(await client.query('SELECT id FROM users WHERE email=$1',[data.email.toLowerCase()])).rows[0];if(!user)throw new DomainError(400,'This email must register an account before it can receive application access');if(userId&&userId!==user.id)throw new DomainError(400,'This staff member already has a linked account');userId=user.id;}
 if(userId){
 const member=(await client.query('SELECT role FROM farm_members WHERE farm_id=$1 AND user_id=$2',[farm,userId])).rows[0];
 if(member?.role==='OWNER')throw new DomainError(400,'Manage owner access in the members table');
 await client.query("INSERT INTO farm_members(farm_id,user_id,role,role_id) VALUES($1,$2,'VIEWER',$3) ON CONFLICT(farm_id,user_id) DO UPDATE SET role_id=EXCLUDED.role_id",[farm,userId,data.roleId]);
 }
 await client.query('UPDATE staff SET role_id=$3,user_id=$4,email=COALESCE(NULLIF($5,\'\'),email),version=version+1 WHERE farm_id=$1 AND id=$2',[farm,id,data.roleId,userId,data.email||'']);
 await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,res.locals.user.id,'staff.role_assigned',id,JSON.stringify(data)]);
 await client.query('COMMIT');res.json({ok:true});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});
workflows.get('/reports/records/:module',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Report not found');
 if(!canAccess(res.locals.farm,m.key))throw new DomainError(403,'Report access denied');
 const filter=z.object({from:z.iso.date().optional(),to:z.iso.date().optional(),search:z.string().max(200).default(''),animal_id:z.uuid().optional(),status:z.string().max(100).optional(),page:z.coerce.number().int().min(1).default(1),format:z.enum(['web','csv']).default('web')}).parse(req.query);
 if(filter.from&&filter.to&&filter.from>filter.to)throw new DomainError(400,'From date must precede to date');
 const date=m.fields.find(f=>f.key==='date')?.key||m.fields.find(f=>f.type==='date')?.key||'created_at';
 const vals:unknown[]=[res.locals.farm.id];let where='r.farm_id=$1';
 const add=(sql:string,value:unknown)=>{vals.push(value);where+=' AND '+sql.replace('?', '$'+vals.length)};
 if(filter.from)add('r.'+date+'::date>=?::date',filter.from);
 if(filter.to)add('r.'+date+'::date<=?::date',filter.to);
 if(filter.animal_id){if(m.key==='animals')add('r.id=?',filter.animal_id);else if(m.fields.some(f=>f.key==='animal_id'))add('r.animal_id=?',filter.animal_id);}
 const state=m.fields.find(f=>['status','disposition','category'].includes(f.key));
 if(filter.status&&state)add('r.'+state.key+'=?',filter.status);
 if(filter.search){const fields=m.fields.filter(f=>['text','select','textarea'].includes(f.type));if(fields.length){vals.push('%'+filter.search+'%');where+=' AND ('+fields.map(f=>'r.'+f.key+' ILIKE $'+vals.length).join(' OR ')+')';}}
 const hasAnimal=m.fields.some(f=>f.key==='animal_id');
 const join=hasAnimal?' LEFT JOIN animals a ON a.id=r.animal_id AND a.farm_id=r.farm_id':'';
 const total=(await db.query('SELECT count(*)::int AS total FROM '+m.key+' r WHERE '+where,vals)).rows[0].total;
 const rows=(await db.query('SELECT r.*'+(hasAnimal?",concat_ws(' — ',a.tag,NULLIF(a.name,'')) AS animal_label":'')+' FROM '+m.key+' r'+join+' WHERE '+where+' ORDER BY r.'+date+' DESC,r.id LIMIT '+(filter.format==='csv'?10000:50)+' OFFSET '+(filter.format==='csv'?0:(filter.page-1)*50),vals)).rows;
 const columns=m.fields.map(f=>({key:f.key==='animal_id'?'animal_label':f.key,label:f.en}));
 if(filter.format==='csv'){
 const cell=(v:unknown)=>{let s=v instanceof Date?v.toISOString().slice(0,10):String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 res.attachment(m.key+'.csv').type('text/csv').send('\uFEFF'+[columns.map(c=>cell(c.label)).join(','),...rows.map(r=>columns.map(c=>cell(r[c.key])).join(','))].join('\r\n'));
 }else res.json({rows,columns,total,page:filter.page,dateField:date});
});
