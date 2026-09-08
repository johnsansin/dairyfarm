import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
export const consumptionInput=z.array(z.object({item_id:z.uuid(),quantity:z.coerce.number().positive().max(999999999).refine(v=>Math.round(v*1000)===v*1000,'Use at most 3 decimal places')})).max(30).refine(v=>new Set(v.map(x=>x.item_id)).size===v.length,'Choose each stock item once');
export async function stockChange(client:PoolClient,farm:string,user:string,item:string,quantity:string,date:string,reason:string,unitCost:string='0',module:string|null=null,record:string|null=null){
 const r=(await client.query('SELECT * FROM inventory WHERE farm_id=$1 AND id=$2 FOR UPDATE',[farm,item])).rows[0];
 if(!r)throw Object.assign(new Error('Stock item does not belong to this farm'),{status:400});
 const result=await client.query(`UPDATE inventory SET stock_quantity=stock_quantity+$3::numeric,stock_value=CASE WHEN $3::numeric<0 THEN CASE WHEN stock_quantity+$3::numeric=0 THEN 0 ELSE stock_value+($3::numeric*stock_value/NULLIF(stock_quantity,0)) END ELSE stock_value+$3::numeric*$4::numeric END,version=version+1 WHERE farm_id=$1 AND id=$2 AND stock_quantity+$3::numeric>=0 RETURNING *`,[farm,item,quantity,unitCost]);
 if(!result.rowCount)throw Object.assign(new Error('Insufficient stock for '+r.name),{status:400});
 const current=result.rows[0];
 await client.query('INSERT INTO stock_movements(id,farm_id,item_id,date,quantity,value,reason,record_module,record_id,user_id) VALUES($1,$2,$3,$4,$5,$6::numeric-$7::numeric,$8,$9,$10,$11)',[randomUUID(),farm,item,date,quantity,current.stock_value,r.stock_value,reason,module,record,user]);
 return current;
}
export async function applyConsumption(client:PoolClient,farm:string,user:string,module:string,record:string,date:string,items:unknown){
 const parsed=consumptionInput.parse(items);
 for(const item of [...parsed].sort((a,b)=>a.item_id.localeCompare(b.item_id))){
  const row=(await client.query('SELECT category FROM inventory WHERE farm_id=$1 AND id=$2',[farm,item.item_id])).rows[0];
  if(!row||!['Medicine','Vaccine'].includes(row.category))throw Object.assign(new Error('Select medicine or vaccine inventory'),{status:400});
  await stockChange(client,farm,user,item.item_id,'-'+item.quantity,date,'Used in '+module,'0',module,record);
 }
 return parsed;
}
