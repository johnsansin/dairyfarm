/** Run only against a disposable API/database: POS_TEST_API_URL, POS_TEST_ORIGIN, POS_TEST_DATABASE_URL. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const base=process.env.POS_TEST_API_URL,origin=process.env.POS_TEST_ORIGIN,url=process.env.POS_TEST_DATABASE_URL;
if(!base||!origin||!url)throw new Error('Set POS_TEST_API_URL, POS_TEST_ORIGIN and POS_TEST_DATABASE_URL for a disposable test environment');
const db=new pg.Client({connectionString:url});
let cookie='';
async function raw(path:string,method='GET',data?:unknown,session=cookie){return fetch(base+path,{method,headers:{Origin:origin!,'Content-Type':'application/json',Cookie:session},body:data===undefined?undefined:JSON.stringify(data)})}
async function call(path:string,method='GET',data?:unknown,status=200){const r=await raw(path,method,data);const text=await r.text();assert.equal(r.status,status,path+': '+text);return text?JSON.parse(text):null}
async function signup(name:string){const r=await raw('/auth/register','POST',{name,email:`pos-${randomUUID()}@example.invalid`,password:'POS-test-123'});assert.equal(r.status,201);return {user:await r.json() as {id:string},cookie:r.headers.get('set-cookie')!.split(';')[0]}}
async function main(){await db.connect();
try{
 const owner=await signup('POS test owner');cookie=owner.cookie;
 const farm=await call('/farms','POST',{name:'POS Test Farm',city:'Lahore',currency:'PKR'},201),path='/farms/'+farm.id+'/pos';
 const create=async(name:string,stock='10',price='100')=>call(path+'/products','POST',{name,unit:'kg',selling_price:price,opening_stock:stock,unit_cost:'20'},201);
 const yogurt=await create('Yogurt'),butter=await create('Butter','5','200');
 const payload=(id:string,quantity='1',price='100')=>({request_id:randomUUID(),payment_method:'Cash',items:[{item_id:id,quantity,unit_price:price}]});
 const order={...payload(yogurt.id,'1.250'),amount_received:'200'};
 const first=await call(path+'/sales','POST',order,201);assert.equal(first.total,'125.00');assert.equal(first.change_due,'75.00');assert.equal(first.customer_name,'Walk-in customer');
 assert.equal((await call(path+'/sales','POST',order)).id,first.id);
 await call(path+'/sales','POST',{...order,amount_received:'300'},409);
 const stock=async(id:string)=>(await db.query('SELECT stock_quantity FROM inventory WHERE id=$1',[id])).rows[0].stock_quantity;
 assert.equal(await stock(yogurt.id),'8.750');
 const journal=(await db.query('SELECT sum(debit)::text AS debit,sum(credit)::text AS credit FROM journal_entries WHERE farm_id=$1 AND reference=$2',[farm.id,first.receipt_number])).rows[0];assert.equal(journal.debit,'125.00');assert.equal(journal.credit,'125.00');
 let product=(await call(path+'/products')).find((p:any)=>p.id===yogurt.id);
 await call(path+'/products/'+yogurt.id,'PUT',{selling_price:'150',sale_enabled:true,version:product.version});
 await call(path+'/sales','POST',payload(yogurt.id),409);
 assert.equal((await call(path+'/sales/'+first.id)).items[0].unit_price,'100.00');
 await call(path+'/sales','POST',payload(yogurt.id,'0.0001','150'),400);
 await call(path+'/sales','POST',{...payload(yogurt.id,'1','150'),items:[{item_id:yogurt.id,quantity:'1',unit_price:'150'},{item_id:yogurt.id,quantity:'1',unit_price:'150'}]},400);
 await call(path+'/sales','POST',{...payload(yogurt.id,'1','150'),amount_received:'149'},400);
 const before=await stock(yogurt.id);
 await call(path+'/sales','POST',{request_id:randomUUID(),items:[{item_id:yogurt.id,quantity:'1',unit_price:'150'},{item_id:butter.id,quantity:'6',unit_price:'200'}]},400);
 assert.equal(await stock(yogurt.id),before);
 const tiny=await create('Last packet','1','25');
 const race=await Promise.all([raw(path+'/sales','POST',payload(tiny.id,'1','25')),raw(path+'/sales','POST',payload(tiny.id,'1','25'))]);assert.deepEqual(race.map(r=>r.status).sort(),[201,400]);assert.equal(await stock(tiny.id),'0.000');
 const retryProduct=await create('Retry stock','5','10'),same=payload(retryProduct.id,'1','10');
 const retries=await Promise.all([raw(path+'/sales','POST',same),raw(path+'/sales','POST',same)]);assert.deepEqual(retries.map(r=>r.status).sort(),[200,201]);assert.equal(await stock(retryProduct.id),'4.000');
 const buyer=await call('/farms/'+farm.id+'/records/buyers','POST',{name:'Named customer'},201);
 const transfer=await call(path+'/sales','POST',{...payload(butter.id,'1','200'),buyer_id:buyer.id,payment_method:'Online transfer',payment_reference:'BANK-123'},201);assert.equal(transfer.customer_name,'Named customer');assert.equal(transfer.payment_method,'Online transfer');assert.equal(transfer.amount_received,'200.00');assert.equal(transfer.change_due,'0.00');
 const other=await signup('Other farm owner');cookie=other.cookie;const otherFarm=await call('/farms','POST',{name:'Other POS Farm',city:'Lahore',currency:'PKR'},201);const otherProduct=await call('/farms/'+otherFarm.id+'/pos/products','POST',{name:'Other milk',unit:'litre',selling_price:'10',opening_stock:'1'},201);
 await call(path+'/products','GET',undefined,404);await call(path+'/sales/'+first.id,'GET',undefined,404);
 cookie=owner.cookie;await call(path+'/sales','POST',payload(otherProduct.id,'1','10'),400);
 await call(path+'/sales','POST',{...payload(butter.id,'1','200'),buyer_id:other.user.id},400);
 await db.query("INSERT INTO farm_members(farm_id,user_id,role) VALUES($1,$2,'VIEWER')",[farm.id,other.user.id]);cookie=other.cookie;await call(path+'/products','GET',undefined,403);await call(path+'/sales','POST',payload(butter.id,'1','200'),403);cookie=owner.cookie;
 product=(await call(path+'/products')).find((p:any)=>p.id===butter.id);await call(path+'/products/'+butter.id,'PUT',{selling_price:'200',sale_enabled:false,version:product.version});await call(path+'/sales','POST',payload(butter.id,'1','200'),400);
 await db.query('UPDATE farms SET is_active=false WHERE id=$1',[farm.id]);await call(path+'/sales','POST',payload(yogurt.id,'1','150'),403);
 console.log('PASS: POS defaults, fractional quantities, stock deduction, balanced sales journal, cash/change, transfer, customers, price snapshots, stale price rejection, duplicate retries, concurrent oversell prevention, all-or-nothing checkout, tenant isolation, owner authorization, disabled products, suspension.');
}finally{await db.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
