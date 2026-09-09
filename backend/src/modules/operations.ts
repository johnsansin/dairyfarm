import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '../db';
import {getModule} from '../../shared/modules';
import {schemaFor} from './schema';
import {accessFor,canAccess} from './access';
import {applyConsumption} from './stock';
export const operations=Router({mergeParams:true});
export class DomainError extends Error{constructor(public status:number,message:string){super(message)}}
operations.use(async(req,res,next)=>{
 if(!/^\/(summary|records|options|audit|export|reports)(\/|$)/.test(req.path))return next();
 const farmId=(req.params as Record<string,string>).farmId;
 if(!z.uuid().safeParse(farmId).success)throw new DomainError(404,'Farm not found');
 const member=await accessFor(farmId,res.locals.user.id);if(!member)throw new DomainError(404,'Farm not found');
 const parts=req.path.split('/');const module=['records','options','export'].includes(parts[1])?parts[2]:parts[1];
 if(module==='summary'){if(!['animals','milk','vaccinations','tasks'].every(k=>canAccess(member,k)))throw new DomainError(403,'Overview requires access to animals, milk, vaccinations and tasks');}
 else if(!canAccess(member,module==='animal-profitability'?'animals':module,!['GET','HEAD'].includes(req.method)))throw new DomainError(403,'Your role does not permit this action');
 res.locals.farm={id:farmId,...member};next();
});
operations.get('/summary',async(_req,res)=>{
 const farm=res.locals.farm.id;
 const herd=(await db.query("SELECT count(*) FILTER(WHERE disposition='Active')::int AS total, count(*) FILTER(WHERE disposition='Active' AND production_status='Lactating')::int AS lactating, count(*) FILTER(WHERE disposition='Active' AND health_status<>'Healthy')::int AS attention FROM animals WHERE farm_id=$1",[farm])).rows[0];
 const milk=(await db.query("SELECT COALESCE(sum(quantity) FILTER(WHERE date=(now() AT TIME ZONE 'Asia/Karachi')::date),0)::text AS today, COALESCE(sum(quantity) FILTER(WHERE date=(now() AT TIME ZONE 'Asia/Karachi')::date-1),0)::text AS yesterday, COALESCE(sum(quantity) FILTER(WHERE date >=(now() AT TIME ZONE 'Asia/Karachi')::date-29),0)::text AS month FROM milk WHERE farm_id=$1",[farm])).rows[0];
 const trend=(await db.query("SELECT date::text,sum(quantity)::text AS quantity FROM milk WHERE farm_id=$1 AND date>=(now() AT TIME ZONE 'Asia/Karachi')::date-364 GROUP BY date ORDER BY date",[farm])).rows;
 const due=(await db.query("SELECT 'Vaccination' AS kind, v.id, concat_ws(' — ',a.tag,NULLIF(a.name,'')) AS animal, v.vaccine AS title,v.next_due::text AS date FROM vaccinations v JOIN animals a ON a.farm_id=v.farm_id AND a.id=v.animal_id WHERE v.farm_id=$1 AND v.next_due <= (now() AT TIME ZONE 'Asia/Karachi')::date+7 UNION ALL SELECT 'Task',id,NULL,title,date::text FROM tasks WHERE farm_id=$1 AND status NOT IN ('Completed','Verified') AND date <= (now() AT TIME ZONE 'Asia/Karachi')::date+7 ORDER BY date LIMIT 30",[farm])).rows;
 res.json({herd,milk,trend,due,timezone:'Asia/Karachi'});
});
operations.get('/reports/animal-profitability',async(req,res)=>{
 const parsedAnimal=z.uuid().safeParse(req.query.animal_id);if(!parsedAnimal.success)throw new DomainError(400,'Select a valid animal for this report');const animalId=parsedAnimal.data,from=z.iso.date().optional().parse(req.query.from),to=z.iso.date().optional().parse(req.query.to),farm=res.locals.farm.id;
 const animal=(await db.query('SELECT id,tag,name,species,breed,purchase_price FROM animals WHERE farm_id=$1 AND id=$2',[farm,animalId])).rows[0];if(!animal)throw new DomainError(404,'Animal not found');
 const dates:unknown[]=[farm,animalId];let milkWhere='m.farm_id=$1 AND m.animal_id=$2';if(from){dates.push(from);milkWhere+=' AND m.date >= $'+dates.length}if(to){dates.push(to);milkWhere+=' AND m.date <= $'+dates.length}
 const milk=(await db.query(`SELECT COALESCE(sum(m.quantity),0)::text AS produced,COALESCE(sum(m.quantity) FILTER(WHERE m.destination='Tank'),0)::text AS saleable,COALESCE(sum(m.quantity) FILTER(WHERE m.destination='Discarded'),0)::text AS discarded FROM milk m WHERE ${milkWhere}`,dates)).rows[0];
 const allocation=(await db.query(`WITH daily_animal AS (SELECT date,sum(quantity) qty FROM milk WHERE farm_id=$1 AND animal_id=$2 AND destination='Tank' ${from?'AND date >= $3':''} ${to?'AND date <= $'+(from?4:3):''} GROUP BY date),daily_farm AS (SELECT date,sum(quantity) qty FROM milk WHERE farm_id=$1 AND destination='Tank' ${from?'AND date >= $3':''} ${to?'AND date <= $'+(from?4:3):''} GROUP BY date),daily_sales AS (SELECT sale_date AS date,sum(total) total FROM milk_sales WHERE farm_id=$1 ${from?'AND sale_date >= $3':''} ${to?'AND sale_date <= $'+(from?4:3):''} GROUP BY sale_date) SELECT COALESCE(sum(ds.total*da.qty/NULLIF(df.qty,0)),0)::text revenue,COALESCE(sum(da.qty),0)::text allocated_litres FROM daily_animal da JOIN daily_farm df USING(date) JOIN daily_sales ds USING(date)`,dates)).rows[0];
 const costParams:unknown[]=[farm,animalId];let dateFilter='';if(from){costParams.push(from);dateFilter+=' AND date >= $'+costParams.length}if(to){costParams.push(to);dateFilter+=' AND date <= $'+costParams.length}
 const health=Number((await db.query('SELECT COALESCE(sum(cost),0)::text total FROM health WHERE farm_id=$1 AND animal_id=$2'+dateFilter,costParams)).rows[0].total),vaccinations=Number((await db.query('SELECT COALESCE(sum(cost),0)::text total FROM vaccinations WHERE farm_id=$1 AND animal_id=$2'+dateFilter,costParams)).rows[0].total),breeding=Number((await db.query('SELECT COALESCE(sum(cost),0)::text total FROM breeding WHERE farm_id=$1 AND animal_id=$2'+dateFilter,costParams)).rows[0].total);
 const stock=Number((await db.query(`SELECT COALESCE(sum(-sm.value),0)::text total FROM stock_movements sm WHERE sm.farm_id=$1 AND sm.record_module IN ('health','vaccinations') AND EXISTS(SELECT 1 FROM health h WHERE sm.record_module='health' AND h.farm_id=sm.farm_id AND h.id=sm.record_id AND h.animal_id=$2 UNION ALL SELECT 1 FROM vaccinations v WHERE sm.record_module='vaccinations' AND v.farm_id=sm.farm_id AND v.id=sm.record_id AND v.animal_id=$2) ${from?'AND sm.date >= $3':''} ${to?'AND sm.date <= $'+(from?4:3):''}`,costParams)).rows[0].total);
 const animalCosts=(await db.query("SELECT c.*,i.name AS item_name FROM animal_cost_entries c LEFT JOIN inventory i ON i.farm_id=c.farm_id AND i.id=c.item_id WHERE c.farm_id=$1 AND c.animal_id=$2 AND ($3::date IS NULL OR c.entry_date >= $3) AND ($4::date IS NULL OR c.entry_date <= $4) ORDER BY c.entry_date DESC",[farm,animalId,from||null,to||null])).rows;const animalCostTotal=animalCosts.reduce((sum:number,row:any)=>sum+Number(row.total),0);
 const milkDaily=(await db.query("SELECT date::text,sum(quantity)::text produced,sum(quantity) FILTER(WHERE destination='Tank')::text saleable,sum(quantity) FILTER(WHERE destination='Discarded')::text discarded FROM milk WHERE farm_id=$1 AND animal_id=$2 AND ($3::date IS NULL OR date >= $3) AND ($4::date IS NULL OR date <= $4) GROUP BY date ORDER BY date DESC",[farm,animalId,from||null,to||null])).rows;
 const revenue=Number(allocation.revenue),direct=health+vaccinations+breeding+stock+animalCostTotal;
 const activity=(await db.query(`SELECT date::text,'Milk income' type,concat('Allocated ',round(da.qty,3),' L of ',round(df.qty,3),' L farm milk') description,round(ds.total*da.qty/NULLIF(df.qty,0),2)::text amount,'income' category FROM (SELECT date,sum(quantity) qty FROM milk WHERE farm_id=$1 AND animal_id=$2 AND destination='Tank' GROUP BY date) da JOIN (SELECT date,sum(quantity) qty FROM milk WHERE farm_id=$1 AND destination='Tank' GROUP BY date) df USING(date) JOIN (SELECT sale_date date,sum(total) total FROM milk_sales WHERE farm_id=$1 GROUP BY sale_date) ds USING(date) WHERE ($3::date IS NULL OR da.date >= $3) AND ($4::date IS NULL OR da.date <= $4) UNION ALL SELECT date::text,'Treatment',COALESCE(NULLIF(diagnosis,''),NULLIF(symptoms,''),'Health care'),cost::text,'expense' FROM health WHERE farm_id=$1 AND animal_id=$2 AND cost>0 AND ($3::date IS NULL OR date >= $3) AND ($4::date IS NULL OR date <= $4) UNION ALL SELECT date::text,'Vaccination',vaccine,cost::text,'expense' FROM vaccinations WHERE farm_id=$1 AND animal_id=$2 AND cost>0 AND ($3::date IS NULL OR date >= $3) AND ($4::date IS NULL OR date <= $4) UNION ALL SELECT date::text,'Breeding',event,cost::text,'expense' FROM breeding WHERE farm_id=$1 AND animal_id=$2 AND cost>0 AND ($3::date IS NULL OR date >= $3) AND ($4::date IS NULL OR date <= $4) ORDER BY date DESC`,[farm,animalId,from||null,to||null])).rows;
 res.json({animal,period:{from:from||null,to:to||null},milk,summary:{revenue:revenue.toFixed(2),health:health.toFixed(2),vaccinations:vaccinations.toFixed(2),breeding:breeding.toFixed(2),medication_stock:stock.toFixed(2),direct_expenses:direct.toFixed(2),profit_loss:(revenue-direct).toFixed(2),profit_per_litre:Number(milk.saleable)?((revenue-direct)/Number(milk.saleable)).toFixed(2):'0.00',animal_costs:animalCostTotal.toFixed(2)},activity,animalCosts,milkDaily,feedByUnit:Object.values(animalCosts.filter((r:any)=>r.category==='Feed').reduce((map:any,r:any)=>{const key=r.unit;map[key]=map[key]||{unit:key,quantity:0,total:0};map[key].quantity+=Number(r.quantity);map[key].total+=Number(r.total);return map},{})),method:'Milk income is allocated by the animal share of saleable Tank milk on each sale date. Feed, labour, and other shared costs are not included until assigned per animal.'});
});
operations.get('/records/:module',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Module not found');
 const page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
 const search=z.string().max(200).default('').parse(req.query.search);
 const animalId=z.uuid().optional().parse(req.query.animal_id);
 const searchable=m.fields.filter(f=>['text','textarea','select'].includes(f.type));
 const values:unknown[]=[res.locals.farm.id];let where='farm_id=$1';
 if(search&&searchable.length){values.push('%'+search+'%');where+=' AND ('+searchable.map(f=>`${f.key} ILIKE $${values.length}`).join(' OR ')+')';}
 if(animalId&&m.fields.some(f=>f.type==='animal')){values.push(animalId);where+=` AND animal_id=$${values.length}`;}
 const total=(await db.query(`SELECT count(*)::int AS total FROM ${m.key} WHERE ${where}`,values)).rows[0].total;
 const rows=(await db.query(`SELECT * FROM ${m.key} WHERE ${where} ORDER BY created_at DESC,id LIMIT 50 OFFSET ${(page-1)*50}`,values)).rows;
 res.json({rows,total,page,pageSize:50});
});
operations.get('/records/:module/:id',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Module not found');
 const id=z.uuid().parse(req.params.id);
 const row=(await db.query(`SELECT * FROM ${m.key} WHERE farm_id=$1 AND id=$2`,[res.locals.farm.id,id])).rows[0];
 if(!row)throw new DomainError(404,'Record not found');res.json(row);
});
operations.get('/options/animals',async(req,res)=>{
 const search=z.string().max(200).default('').parse(req.query.search);
 const {rows}=await db.query("SELECT id,tag,name FROM animals WHERE farm_id=$1 AND (tag ILIKE $2 OR name ILIKE $2) ORDER BY tag LIMIT 100",[res.locals.farm.id,'%'+search+'%']);res.json(rows);
});
operations.get('/options/buyers',async(_req,res)=>res.json((await db.query('SELECT id,name FROM buyers WHERE farm_id=$1 ORDER BY name LIMIT 500',[res.locals.farm.id])).rows));
operations.get('/options/staff',async(_req,res)=>{
 const staff=(await db.query("SELECT id,name,position,photo FROM staff WHERE farm_id=$1 AND status='Active' ORDER BY name",[res.locals.farm.id])).rows;
 res.json(staff);
});
async function validateRelations(module:string,input:Record<string,unknown>,farm:string,client:import('pg').PoolClient){
 const date=input.date as string|undefined;
 if(date&&module!=='tasks'&&date>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}))throw new DomainError(400,'Recorded events cannot be in the future');
 for(const key of ['end_date','next_due','follow_up','milk_withdrawal_until','meat_withdrawal_until','expected_date'])if(input[key]&&date&&String(input[key])<date)throw new DomainError(400,'Follow-up and end dates cannot precede the event');
 if(module==='animals'){
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
  for(const key of ['birth_date','purchase_date'])if(input[key]&&String(input[key])>today)throw new DomainError(400,'Birth and purchase dates cannot be in the future');
  if(input.birth_date&&input.purchase_date&&String(input.birth_date)>String(input.purchase_date))throw new DomainError(400,'Purchase date cannot precede birth');
 }
 if(input.animal_id){const a=(await client.query('SELECT * FROM animals WHERE farm_id=$1 AND id=$2 FOR SHARE',[farm,input.animal_id])).rows[0];if(!a)throw new DomainError(400,'Animal does not belong to this farm');
  if(module==='milk'){
   if(a.sex!=='Female'||a.disposition!=='Active'||a.production_status!=='Lactating')throw new DomainError(400,'Milk recording requires an active lactating female animal');
   if(input.destination==='Tank'&&(await client.query('SELECT 1 FROM health WHERE farm_id=$1 AND animal_id=$2 AND date <= $3 AND milk_withdrawal_until >= $3 LIMIT 1',[farm,input.animal_id,input.date])).rowCount)throw new DomainError(400,'Milk withdrawal applies on this date. Record restricted milk as discarded.');
  }
 }
}
operations.post('/records/:module',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Module not found');const input=await recordInput(m,req.body,res.locals.farm.id);const id=randomUUID();const farm=res.locals.farm.id;const client=await db.connect();
 try{await client.query('BEGIN');await validateRelations(m.key,input,farm,client);
 if(['health','vaccinations'].includes(m.key)&&input.stock_items)await applyConsumption(client,farm,res.locals.user.id,m.key,id,String(input.date),input.stock_items);
 const keys=Object.keys(input);const values=[id,farm,...Object.values(input).map(v=>Array.isArray(v)?JSON.stringify(v):v)];
 const row=(await client.query(`INSERT INTO ${m.key}(id,farm_id,${keys.join(',')}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,values)).rows[0];
 await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,res.locals.user.id,m.key+'.created',id,JSON.stringify(row)]);
 await client.query('COMMIT');res.status(201).json(row);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operations.put('/records/:module/:id',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Module not found');const id=z.uuid().parse(req.params.id);
 const {version,...body}=req.body;const expected=z.number().int().positive().parse(version);const input=await recordInput(m,body,res.locals.farm.id);const farm=res.locals.farm.id;const client=await db.connect();
 try{await client.query('BEGIN');
 const old=(await client.query(`SELECT * FROM ${m.key} WHERE farm_id=$1 AND id=$2 FOR UPDATE`,[farm,id])).rows[0];if(!old)throw new DomainError(404,'Record not found');if(old.version!==expected)throw new DomainError(409,'This record changed. Reload it before editing.');
 if(m.key==='inventory'&&old.unit!==input.unit&&(await client.query('SELECT 1 FROM stock_movements WHERE farm_id=$1 AND item_id=$2 LIMIT 1',[farm,id])).rowCount)throw new DomainError(400,'Unit cannot change after stock movements');
 if(['health','vaccinations'].includes(m.key)&&JSON.stringify(old.stock_items||[])!==JSON.stringify(input.stock_items||[])){
  if((old.stock_items||[]).length)throw new DomainError(400,'Recorded stock consumption cannot be edited. Add a stock adjustment with a reason.');
  await applyConsumption(client,farm,res.locals.user.id,m.key,id,String(input.date),input.stock_items||[]);
 }
 await validateRelations(m.key,input,farm,client);
 const keys=Object.keys(input);const values=[farm,id,...Object.values(input).map(v=>Array.isArray(v)?JSON.stringify(v):v)];const row=(await client.query(`UPDATE ${m.key} SET ${keys.map((k,i)=>k+'=$'+(i+3)).join(',')},version=version+1 WHERE farm_id=$1 AND id=$2 RETURNING *`,values)).rows[0];
 await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,old_value,new_value) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),farm,res.locals.user.id,m.key+'.updated',id,JSON.stringify(old),JSON.stringify(row)]);
 await client.query('COMMIT');res.json(row);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
});
operations.delete('/records/:module/:id',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Module not found');
 const id=z.uuid().parse(req.params.id);const farm=res.locals.farm.id;const client=await db.connect();
 try{
  await client.query('BEGIN');
  const old=(await client.query(`SELECT * FROM ${m.key} WHERE farm_id=$1 AND id=$2 FOR UPDATE`,[farm,id])).rows[0];
  if(!old)throw new DomainError(404,'Record not found');
  if(old.stock_items?.length)throw new DomainError(400,'This record has stock consumption history and cannot be deleted');
  await client.query(`DELETE FROM ${m.key} WHERE id=$1`,[id]);
  await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,old_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,res.locals.user.id,m.key+'.deleted',id,JSON.stringify(old)]);
  await client.query('COMMIT');res.json({ok:true});
 }catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23503')throw new DomainError(400,'Cannot delete: this record has linked history. Keep it, or remove the related records first.');throw e;}finally{client.release();}
});
operations.get('/audit',async(_req,res)=>res.json((await db.query('SELECT a.id,a.action,a.record_id,a.created_at,u.name AS actor FROM audit_logs a JOIN users u ON u.id=a.user_id WHERE farm_id=$1 ORDER BY created_at DESC LIMIT 100',[res.locals.farm.id])).rows));
operations.get('/export/:module',async(req,res)=>{
 const m=getModule(String(req.params.module));if(!m)throw new DomainError(404,'Module not found');
 const {rows}=await db.query(`SELECT * FROM ${m.key} WHERE farm_id=$1 ORDER BY created_at DESC LIMIT 10000`,[res.locals.farm.id]);
 const keys=['id',...m.fields.map(f=>f.key)];const cell=(v:unknown)=>{let s=v instanceof Date?v.toISOString().slice(0,10):String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 await db.query('INSERT INTO audit_logs(id,farm_id,user_id,action) VALUES($1,$2,$3,$4)',[randomUUID(),res.locals.farm.id,res.locals.user.id,m.key+'.exported']);
 res.setHeader('Content-Disposition',`attachment; filename="${m.key}.csv"`);res.type('text/csv').send('\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n'));
});

async function recordInput(m:import('../../shared/modules').Module,body:any,farm:string){
 const overrides=(await db.query('SELECT field,values FROM dropdown_options WHERE farm_id=$1 AND module=$2',[farm,m.key])).rows;
 const effective={...m,fields:m.fields.map(f=>({...f,options:overrides.find(o=>o.field===f.key)?.values??f.options}))};
 let schema=schemaFor(effective);
 if(['animals','staff'].includes(m.key))schema=schema.extend({photo:z.string().max(2_800_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).nullable().optional()});
 if(['health','vaccinations'].includes(m.key))schema=schema.extend({stock_items:z.array(z.object({item_id:z.uuid(),quantity:z.coerce.number().positive()})).default([])});
 return schema.parse(body);
}
