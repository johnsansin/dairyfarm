import {Router} from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db} from '../db';
import {DomainError} from './operations';
import {stockChange} from './stock';

export const posRouter=Router({mergeParams:true});
// POS access and price management are restricted to farm owners.
posRouter.use((_req,res,next)=>{if(res.locals.farm.role!=='OWNER')throw new DomainError(403,'Only farm owners can use the point of sale');next()});
const decimal=(scale:number,max:number,positive=false)=>z.union([z.number(),z.string()]).transform(String).refine(v=>new RegExp('^\\d+(\\.\\d{1,'+scale+'})?$').test(v)&&Number(v)<=max&&(positive?Number(v)>0:Number(v)>=0),'Enter a valid amount with at most '+scale+' decimal places');
const money=decimal(2,999999999),quantity=decimal(3,999999);
const productInput=z.object({name:z.string().trim().min(1).max(200),unit:z.enum(['litre','kg','cup','pack','piece']),selling_price:money,opening_stock:quantity.default('0'),unit_cost:decimal(6,999999999).default('0')}).strict();
const checkoutInput=z.object({request_id:z.uuid(),buyer_id:z.uuid().nullable().default(null),payment_method:z.enum(['Cash','Online transfer']).default('Cash'),payment_reference:z.string().trim().max(100).default(''),amount_received:money.optional(),items:z.array(z.object({item_id:z.uuid(),quantity:decimal(3,999999,true),unit_price:money}).strict()).min(1).max(100).refine(items=>new Set(items.map(i=>i.item_id)).size===items.length,'Combine duplicate products into one line')}).strict();
const cents=(value:string)=>{const [whole,fraction='']=value.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))};
const amount=(value:bigint)=>(value/100n)+'.'+String(value%100n).padStart(2,'0');
async function receipt(client:Pick<PoolClient,'query'>,farm:string,id:string){
 const sale=(await client.query('SELECT * FROM pos_sales WHERE farm_id=$1 AND id=$2',[farm,id])).rows[0];
 if(!sale)throw new DomainError(404,'Receipt not found');
 const {request_hash,request_id,...safe}=sale;
 return {...safe,items:(await client.query('SELECT item_id,name,unit,quantity,unit_price,total FROM pos_sale_items WHERE farm_id=$1 AND sale_id=$2 ORDER BY position',[farm,id])).rows};
}
async function audit(client:PoolClient,farm:string,user:string,action:string,id:string,value:unknown){await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farm,user,action,id,JSON.stringify(value)])}
posRouter.get('/products',async(_req,res)=>{res.json((await db.query('SELECT id,name,category,unit,stock_quantity,selling_price,sale_enabled,version FROM inventory WHERE farm_id=$1 ORDER BY name,id',[res.locals.farm.id])).rows)});
posRouter.get('/customers',async(_req,res)=>{res.json((await db.query('SELECT id,name FROM buyers WHERE farm_id=$1 ORDER BY name,id',[res.locals.farm.id])).rows)});
posRouter.post('/products',async(req,res)=>{
 const input=productInput.parse(req.body),farm=res.locals.farm.id,user=res.locals.user.id,id=randomUUID(),client=await db.connect();
 try{await client.query('BEGIN');
 await client.query("INSERT INTO inventory(id,farm_id,name,category,unit,minimum_stock,sale_enabled,selling_price) VALUES($1,$2,$3,'Finished product',$4,0,true,$5)",[id,farm,input.name,input.unit,input.selling_price]);
 if(Number(input.opening_stock)>0)await stockChange(client,farm,user,id,input.opening_stock,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'}),'POS opening stock',input.unit_cost,'pos_product',id);
 await audit(client,farm,user,'pos.product.created',id,input);const row=(await client.query('SELECT * FROM inventory WHERE farm_id=$1 AND id=$2',[farm,id])).rows[0];
 await client.query('COMMIT');res.status(201).json(row);
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});
posRouter.put('/products/:id',async(req,res)=>{
 const id=z.uuid().parse(req.params.id),input=z.object({selling_price:money,sale_enabled:z.boolean(),version:z.number().int().positive()}).strict().parse(req.body),farm=res.locals.farm.id,client=await db.connect();
 try{await client.query('BEGIN');const row=(await client.query('UPDATE inventory SET selling_price=$3,sale_enabled=$4,version=version+1 WHERE farm_id=$1 AND id=$2 AND version=$5 RETURNING *',[farm,id,input.selling_price,input.sale_enabled,input.version])).rows[0];
 if(!row)throw new DomainError(409,'Product changed. Refresh products before editing.');
 await audit(client,farm,res.locals.user.id,'pos.product.updated',id,input);await client.query('COMMIT');res.json(row);
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});
posRouter.get('/sales',async(_req,res)=>{res.json((await db.query('SELECT id,receipt_number,customer_name,total,currency,payment_method,created_at FROM pos_sales WHERE farm_id=$1 ORDER BY created_at DESC LIMIT 100',[res.locals.farm.id])).rows)});
posRouter.get('/sales/:id',async(req,res)=>{res.json(await receipt(db,res.locals.farm.id,z.uuid().parse(req.params.id)))});
posRouter.post('/sales',async(req,res)=>{
 const input=checkoutInput.parse(req.body),farm=res.locals.farm.id,user=res.locals.user.id,client=await db.connect();
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 try{await client.query('BEGIN');
 // Serialize retries for the same checkout before checking its result.
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[farm+':'+input.request_id]);
 const existing=(await client.query('SELECT id,request_hash FROM pos_sales WHERE farm_id=$1 AND request_id=$2',[farm,input.request_id])).rows[0];
 if(existing){if(existing.request_hash!==hash)throw new DomainError(409,'This checkout reference has already been used');const saved=await receipt(client,farm,existing.id);await client.query('COMMIT');res.json(saved);return}
 const farmRow=(await client.query('SELECT name,address,phone,currency,is_active FROM farms WHERE id=$1 FOR SHARE',[farm])).rows[0];
 if(!farmRow?.is_active)throw new DomainError(403,'This farm is suspended');
 let customer='Walk-in customer';if(input.buyer_id){const buyer=(await client.query('SELECT name FROM buyers WHERE farm_id=$1 AND id=$2 FOR SHARE',[farm,input.buyer_id])).rows[0];if(!buyer)throw new DomainError(400,'Customer does not belong to this farm');customer=buyer.name}
 // Lock in a stable order so simultaneous tills cannot oversell or deadlock.
 const products=(await client.query('SELECT * FROM inventory WHERE farm_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[farm,input.items.map(i=>i.item_id)])).rows;
 const lines: {item_id:string;name:string;unit:string;quantity:string;unit_price:string;total:string}[]=[];let total=0n;
 for(const item of input.items){
 const product=products.find(p=>p.id===item.item_id);
 if(!product||!product.sale_enabled)throw new DomainError(400,'A selected product is unavailable. Refresh products.');
 if(cents(product.selling_price)!==cents(item.unit_price))throw new DomainError(409,'Price changed for '+product.name+'. Refresh products and review the cart.');
 if(Number(product.stock_quantity)<Number(item.quantity))throw new DomainError(400,'Insufficient stock for '+product.name);
 const value=(await client.query('SELECT round($1::numeric*$2::numeric,2)::text AS total',[item.quantity,product.selling_price])).rows[0].total;
 total+=cents(value);lines.push({item_id:item.item_id,name:product.name,unit:product.unit,quantity:item.quantity,unit_price:product.selling_price,total:value});
 }
 if(total<=0n||total>99999999900n)throw new DomainError(400,'Sale total must be between 0.01 and 999999999');
 const received=input.payment_method==='Cash'?cents(input.amount_received??amount(total)):total;
 if(received<total)throw new DomainError(400,'Cash received is less than the sale total');
 const id=randomUUID(),number='POS-'+id.toUpperCase(),date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
 await client.query('INSERT INTO pos_sales(id,farm_id,request_id,request_hash,receipt_number,buyer_id,customer_name,farm_name,farm_address,farm_phone,currency,payment_method,payment_reference,total,amount_received,change_due,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[id,farm,input.request_id,hash,number,input.buyer_id,customer,farmRow.name,farmRow.address,farmRow.phone,farmRow.currency,input.payment_method,input.payment_reference,amount(total),amount(received),amount(received-total),user]);
 for(const [index,line] of lines.entries())await client.query('INSERT INTO pos_sale_items(id,farm_id,sale_id,item_id,position,name,unit,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),farm,id,line.item_id,index,line.name,line.unit,line.quantity,line.unit_price,line.total]);
 for(const line of [...lines].sort((a,b)=>a.item_id.localeCompare(b.item_id)))await stockChange(client,farm,user,line.item_id,'-'+line.quantity,date,'POS sale '+number,'0','pos_sale',id);
 const accounts=[{code:'POS-SALES',name:'Point of sale revenue',type:'Income',category:'Sales'},{code:input.payment_method==='Cash'?'POS-CASH':'POS-BANK',name:input.payment_method==='Cash'?'POS cash':'POS bank transfers',type:'Asset',category:'Cash'}];
 for(const [index,account] of accounts.entries()){
 await client.query('INSERT INTO chart_of_accounts(id,farm_id,code,name,account_type,category) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(farm_id,code) DO NOTHING',[randomUUID(),farm,account.code,account.name,account.type,account.category]);
 const saved=(await client.query('SELECT id,account_type,is_active FROM chart_of_accounts WHERE farm_id=$1 AND code=$2 FOR SHARE',[farm,account.code])).rows[0];
 if(saved.account_type!==account.type||!saved.is_active)throw new DomainError(400,'The '+account.name+' account must be active and have type '+account.type);
 await client.query("INSERT INTO journal_entries(id,farm_id,account_id,entry_date,entry_type,description,debit,credit,reference) VALUES($1,$2,$3,$4,'General',$5,$6,$7,$8)",[randomUUID(),farm,saved.id,date,'POS sale '+number,index===1?amount(total):'0',index===0?amount(total):'0',number]);
 }
 await audit(client,farm,user,'pos.sale.created',id,{receipt_number:number,total:amount(total),payment_method:input.payment_method});
 const result=await receipt(client,farm,id);await client.query('COMMIT');res.status(201).json(result);
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});
