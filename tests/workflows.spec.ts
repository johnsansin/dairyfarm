import {test,expect} from '@playwright/test';

test('permissions, searchable reports, photos and treatment stock stay consistent',async({page,playwright,baseURL})=>{
 const origin=new URL(baseURL!).origin,headers={Origin:origin};
 const owner=page.request,staffUser=await playwright.request.newContext({baseURL,extraHTTPHeaders:headers});
 const stamp=Date.now(),password='Workflow-test-12345';
 try{
  expect((await owner.post('/api/v1/auth/register',{headers,data:{name:'Workflow owner',email:`workflow-owner-${stamp}@example.invalid`,password}})).status()).toBe(201);
  const staffEmail=`workflow-staff-${stamp}@example.invalid`;
  expect((await staffUser.post('/api/v1/auth/register',{data:{name:'Workflow staff',email:staffEmail,password}})).status()).toBe(201);
  const farmResponse=await owner.post('/api/v1/farms',{headers,data:{name:'Workflow Farm',city:'Lahore',currency:'PKR'}});
  const farm=(await farmResponse.json()).id,base='/api/v1/farms/'+farm;
  const roleResponse=await owner.post(base+'/roles',{headers,data:{name:'Health worker',permissions:[{module:'animals',access:'read'},{module:'health',access:'write'},{module:'inventory',access:'read'}]}});
  const role=(await roleResponse.json()).id;
  const staffResponse=await owner.post(base+'/records/staff',{headers,data:{name:'Ali Worker',phone:'',position:'Veterinary Assistant',joining_date:null,salary:null,status:'Active',notes:'Vaccination team',photo:null}});
  const staff=(await staffResponse.json()).id;
  expect((await owner.put(base+'/team/staff/'+staff,{headers,data:{roleId:role,email:staffEmail}})).status()).toBe(200);
  expect((await staffUser.get(base+'/records/animals')).status()).toBe(200);
  expect((await staffUser.post(base+'/records/animals',{data:{}})).status()).toBe(403);
  expect((await staffUser.get(base+'/records/milk')).status()).toBe(403);
  const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const animalResponse=await owner.post(base+'/records/animals',{headers,data:{tag:'WF-01',name:'Rani',species:'Cattle',breed:'Sahiwal',sex:'Female',birth_date:null,stage:'Adult',production_status:'Lactating',reproductive_status:'Open',health_status:'Healthy',disposition:'Active',location:'Shed 1',rfid:null,purchase_date:null,purchase_price:null,notes:'',photo}});
  expect(animalResponse.status()).toBe(201);const animal=await animalResponse.json();
  expect(animal.photo).toBe(photo);
  const stockResponse=await owner.post(base+'/records/inventory',{headers,data:{name:'Mastitis medicine',category:'Medicine',unit:'dose',minimum_stock:'2',storage:'Cold room',notes:''}});
  const item=(await stockResponse.json()).id;
  expect((await owner.post(base+'/stock/'+item+'/movements',{headers,data:{direction:'add',quantity:10,unit_cost:25,date:new Date().toISOString().slice(0,10),reason:'Opening balance'}})).status()).toBe(201);
  const treatment={animal_id:animal.id,date:new Date().toISOString().slice(0,10),symptoms:'Fever',diagnosis:'Infection',veterinarian:'Dr Test',medicine:'Mastitis medicine',dose:'2 doses',end_date:null,follow_up:null,milk_withdrawal_until:null,meat_withdrawal_until:null,status:'Active',cost:null,notes:'',stock_items:[{item_id:item,quantity:2}]};
  expect((await staffUser.post(base+'/records/health',{data:treatment})).status()).toBe(201);
  const stock=await (await owner.get(base+'/stock')).json();expect(stock.find((x:any)=>x.id===item).stock_quantity).toBe('8.000');
  const insufficient=await staffUser.post(base+'/records/health',{data:{...treatment,symptoms:'Second treatment',stock_items:[{item_id:item,quantity:20}]}});
  expect(insufficient.status()).toBe(400);
  expect((await (await owner.get(base+'/stock')).json()).find((x:any)=>x.id===item).stock_quantity).toBe('8.000');
  const report=await (await owner.get(base+'/reports/records/health?animal_id='+animal.id+'&search=Fever')).json();
  expect(report.total).toBe(1);expect(report.rows[0].animal_label).toBe('WF-01 — Rani');
  const csv=await owner.get(base+'/reports/records/health?animal_id='+animal.id+'&format=csv');
  expect(csv.status()).toBe(200);expect(await csv.text()).toContain('WF-01 — Rani');
  const notifs=await (await owner.get(base+'/notifications')).json();expect(notifs.rows.some((n:any)=>n.title.includes('Low stock'))).toBeFalsy();
  expect((await owner.post(base+'/stock/'+item+'/movements',{headers,data:{direction:'consume',quantity:6,unit_cost:0,date:new Date().toISOString().slice(0,10),reason:'Manual consumption'}})).status()).toBe(201);
  const low=await (await owner.get(base+'/notifications')).json();expect(low.rows.some((n:any)=>n.title==='Low stock: Mastitis medicine')).toBeTruthy();
 }finally{await staffUser.dispose()}
});
