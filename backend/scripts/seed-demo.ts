import 'dotenv/config';
import {db} from '../src/db';
import {randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';

const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
const daysAgo=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});};
const daysAhead=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});};
const yearsAgo=(y:number,extra=0)=>{const d=new Date();d.setFullYear(d.getFullYear()-y);d.setDate(d.getDate()-extra);return d.toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});};

async function main(){
 const email='demo@alnoor.invalid';
 const userRes=await db.query('SELECT id FROM users WHERE email=$1',[email]);
 let userId=userRes.rows[0]?.id;
 if(!userId){
  userId=randomUUID();
  await db.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',[userId,'Al-Noor Demo Owner',email,await hash('Demo-password-123',12)]);
  console.log('Created demo user:',email,'/ Demo-password-123');
 }else console.log('Reusing existing demo user:',email);

 const farmRes=await db.query('SELECT id FROM farms WHERE name=$1',['Al-Noor Dairy Farm']);
 let farmId=farmRes.rows[0]?.id;
 if(!farmId){
  farmId=randomUUID();
  await db.query('INSERT INTO farms(id,name,city,currency) VALUES($1,$2,$3,$4)',[farmId,'Al-Noor Dairy Farm','Sheikhupura','PKR']);
  await db.query("INSERT INTO farm_members(farm_id,user_id,role) VALUES($1,$2,'OWNER')",[farmId,userId]);
  await db.query('INSERT INTO audit_logs(id,farm_id,user_id,action) VALUES($1,$2,$3,$4)',[randomUUID(),farmId,userId,'farm.created']);
  console.log('Created farm: Al-Noor Dairy Farm');
  }else console.log('Reusing existing farm: Al-Noor Dairy Farm');
  await db.query("INSERT INTO farm_members(farm_id,user_id,role) VALUES($1,$2,'OWNER') ON CONFLICT (farm_id,user_id) DO NOTHING",[farmId,userId]);

 const count=await db.query('SELECT count(*)::int AS c FROM animals WHERE farm_id=$1',[farmId]);
 if(count.rows[0].c>0){console.log('Farm already has data — no changes made.');await db.end();return;}

 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const log=(action:string,recordId:string|null=null,newValue:unknown=null)=>client.query('INSERT INTO audit_logs(id,farm_id,user_id,action,record_id,new_value) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),farmId,userId,action,recordId,newValue?JSON.stringify(newValue):null]);

  // ---- Herd ----
  const A=(tag:string,name:string,species:'Cattle'|'Buffalo',breed:string,sex:'Female'|'Male',birth:string,stage:'Calf'|'Heifer'|'Adult',prod:'Lactating'|'Dry'|'Not producing',repro:'Unknown'|'Open'|'Pregnant',health:'Healthy'|'Sick'|'Under treatment',dispo:'Active'|'Sold'|'Dead'|'Transferred',location='Main shed',purchase?:string,price?:number,notes?:string)=>{
   const id=randomUUID();
   const opts:any={id,farm_id:farmId,tag,name,species,breed,sex,birth_date:birth,stage,production_status:prod,reproductive_status:repro,health_status:health,disposition:dispo,location,notes:notes||null};
   if(purchase){opts.purchase_date=purchase;opts.purchase_price=price??null;}
   const keys=Object.keys(opts);const vals=[...Object.values(opts)];
   return (async()=>{await client.query(`INSERT INTO animals(${keys.join(',')}) VALUES(${vals.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`,vals);return id;})();
  };

  // Buffalo milking herd (lactating females) + dry + heifers + calves + one bull
  const b1=await A('B-01','Ganga','Buffalo','Nili-Ravi','Female',yearsAgo(5),'Adult','Lactating','Pregnant','Healthy','Active','Milking line',yearsAgo(5),210000);
  const b2=await A('B-02','Moti','Buffalo','Nili-Ravi','Female',yearsAgo(4),'Adult','Lactating','Open','Healthy','Active','Milking line',yearsAgo(4),185000);
  const b3=await A('B-03','Rani','Buffalo','Kundi','Female',yearsAgo(6),'Adult','Lactating','Pregnant','Healthy','Active','Milking line',yearsAgo(6),195000);
  const b4=await A('B-04','Kali','Buffalo','Nili-Ravi','Female',yearsAgo(4,120),'Adult','Dry','Pregnant','Healthy','Active','Dry shed',yearsAgo(4,120),175000);
  const b5=await A('B-05','Champa','Buffalo','Murrah','Female',yearsAgo(3),'Adult','Lactating','Pregnant','Healthy','Active','Milking line',yearsAgo(3),205000);
  const b6=await A('B-06','Sona','Buffalo','Nili-Ravi','Female',yearsAgo(5,60),'Adult','Lactating','Open','Under treatment','Active','Milking line',yearsAgo(5,60),190000,'Mild mastitis, under treatment');
  const b7=await A('B-07','Neelam','Buffalo','Murrah','Female',yearsAgo(7),'Adult','Dry','Pregnant','Healthy','Active','Dry shed',yearsAgo(7),220000);
  // Heifers + calves
  const h1=await A('H-01','Shamli','Buffalo','Nili-Ravi','Female',yearsAgo(2),'Heifer','Not producing','Open','Healthy','Active','Heifer pen');
  const h2=await A('H-02','Tara','Buffalo','Nili-Ravi','Female',yearsAgo(1,200),'Heifer','Not producing','Open','Healthy','Active','Heifer pen');
  const c1=await A('C-01','Rani ki Bacchi','Buffalo','Nili-Ravi','Female',daysAgo(40),'Calf','Not producing','Unknown','Healthy','Active','Calf pen');
  const c2=await A('C-02','Moti ka Bada','Buffalo','Nili-Ravi','Male',daysAgo(60),'Calf','Not producing','Unknown','Healthy','Active','Calf pen');
  // Bull
  const bull=await A('BL-01','Sultan','Buffalo','Nili-Ravi','Male',yearsAgo(4),'Adult','Not producing','Unknown','Healthy','Active','Bull shed',yearsAgo(4),160000);
  // Cattle
  const cw1=await A('CW-01','White Rose','Cattle','Sahiwal','Female',yearsAgo(6),'Adult','Lactating','Pregnant','Healthy','Active','Cattle shed',yearsAgo(6),150000);
  const cw2=await A('CW-02','White Lilly','Cattle','Sahiwal','Female',yearsAgo(4),'Adult','Lactating','Open','Healthy','Active','Cattle shed',yearsAgo(4),140000);
  const ch1=await A('CH-01','Sahiwal Heifer','Cattle','Sahiwal','Female',yearsAgo(1,150),'Heifer','Not producing','Open','Healthy','Active','Heifer pen');

  // ---- Milk recording (last 14 days, lactating females) ----
  const milkers={[b1]:{m:[11.5,10.9,11.1,12.0,11.4,10.8,11.6,12.2,11.9,11.2,11.7,10.9,11.4,12.1],e:[9.2,8.8,9.0,9.5,9.1,8.7,9.3,9.6,9.4,9.0,9.2,8.9,9.1,9.5]},[b2]:{m:[9.8,9.6,10.1,9.9,10.3,9.7,10.0,10.2,9.9,10.1,9.5,10.0,9.8,10.3],e:[7.9,7.7,7.8,8.0,8.1,7.6,8.0,7.9,8.1,7.8,8.0,7.7,7.9,8.1]},[b3]:{m:[10.6,10.2,10.8,10.5,10.9,10.4,10.7,11.0,10.6,10.8,10.3,10.9,10.7,11.1],e:[8.4,8.2,8.5,8.3,8.6,8.1,8.5,8.7,8.4,8.6,8.2,8.5,8.3,8.8]},[b5]:{m:[9.2,9.0,9.5,9.3,9.6,9.1,9.4,9.7,9.3,9.5,9.0,9.4,9.2,9.6],e:[7.5,7.3,7.6,7.4,7.7,7.2,7.5,7.8,7.6,7.4,7.2,7.6,7.5,7.7]},[b6]:{m:[8.1,7.9,8.0,7.8,8.2,0,0,0,0,0,0,0,0,0],e:[6.4,6.2,6.3,6.1,6.5,0,0,0,0,0,0,0,0,0]},[cw1]:{m:[12.8,12.4,12.9,12.6,13.0,12.5,12.7,13.1,12.9,12.6,12.8,12.4,12.9,13.2],e:[10.1,9.9,10.2,10.0,10.4,9.8,10.1,10.5,10.2,10.0,10.3,9.9,10.2,10.4]},[cw2]:{m:[11.2,11.0,11.5,11.3,11.6,11.1,11.4,11.8,11.5,11.2,11.6,11.1,11.4,11.7],e:[8.9,8.7,9.0,8.8,9.1,8.6,9.0,9.2,8.9,8.8,9.1,8.7,9.0,9.2]}};
  const dest=['Tank','Tank','Tank','Calves'];
  for(const [animalId,se] of Object.entries(milkers)){
   for(let d=13;d>=0;d--){
    const mq=se.m[d] as number;
    if(mq>0){const mId=randomUUID();await client.query('INSERT INTO milk(id,farm_id,animal_id,date,session,quantity,fat,snf,destination,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)',[mId,farmId,animalId,daysAgo(d),'Morning',mq,(6.8+(d%3)*0.1).toFixed(2),(8.7+(d%2)*0.2).toFixed(2),'Tank']);await log('milk.created',mId,{animal_id:animalId,date:daysAgo(d),session:'Morning',quantity:mq,destination:'Tank'});}
    const eq=se.e[d] as number;
    if(eq>0){const eId=randomUUID();await client.query('INSERT INTO milk(id,farm_id,animal_id,date,session,quantity,fat,snf,destination,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)',[eId,farmId,animalId,daysAgo(d),'Evening',eq,(7.0+(d%2)*0.1).toFixed(2),(8.5+(d%3)*0.1).toFixed(2),'Calves'===dest[d%4]?'Calves':'Tank']);await log('milk.created',eId,{animal_id:animalId,date:daysAgo(d),session:'Evening',quantity:eq});}
   }
  }
  // A few calves receiving milk from the tank (distinct calves, distinct dates/sessions):
  const calfMilk=[[c1,daysAgo(1),'Morning',0.8],[c2,daysAgo(1),'Evening',0.7]];
  for(const [animalId,date,session,q] of calfMilk){const mId=randomUUID();await client.query('INSERT INTO milk(id,farm_id,animal_id,date,session,quantity,destination,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[mId,farmId,animalId,date,session,q,'Calves','Calf feeding']);await log('milk.created',mId,{animal_id:animalId,date,session,quantity:q,destination:'Calves'});}

  // ---- Weights ----
  const weightFor=(animalId:string)=>{if(animalId===c1)return 45;if(animalId===c2)return 60;if(animalId===h1)return 230;if(animalId===h2)return 180;if(animalId===cw1)return 520;if(animalId===cw2)return 500;return 610+Math.floor(Math.random()*40);};
  for(const a of [b1,b2,b3,b5,c1,c2,h1,h2,cw1,cw2]){
   const wid=randomUUID();const w=weightFor(a);
   await client.query('INSERT INTO weights(id,farm_id,animal_id,date,weight,body_condition,notes) VALUES($1,$2,$3,$4,$5,$6,NULL)',[wid,farmId,a,daysAgo(3),w,(3.5).toFixed(1)]);
   await log('weights.created',wid,{animal_id:a,date:daysAgo(3),weight:w});
  }

  // ---- Health ----
  const hrec=[[b6,daysAgo(5),'Swollen udder, fever','Clinical mastitis','Dr. Ali Raza','Amoxicillin + anti-inflammatory','10ml IM once daily x3 days',daysAgo(2),daysAgo(1),daysAgo(2),daysAgo(5),'Active',2500,'Mild case, responding to treatment']];
  const hrec2=[[cw1,daysAgo(10),'Lameness left hind foot','Hoof infection','Dr. Ali Raza','Antiseptic dressing','Clean and bandage',daysAgo(8),daysAgo(7),null,null,'Completed',1200,'Recovered fully']];
  for(const [animalId,date,symptoms,diagnosis,vet,medicine,dose,endDate,follow,milkW,meatW,status,cost,notes] of [...hrec,...hrec2]){
   const hid=randomUUID();
   await client.query('INSERT INTO health(id,farm_id,animal_id,date,symptoms,diagnosis,veterinarian,medicine,dose,end_date,follow_up,milk_withdrawal_until,meat_withdrawal_until,status,cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[hid,farmId,animalId,date,symptoms,diagnosis,vet,medicine,dose,endDate,follow,milkW,meatW,status,cost,notes]);
   await log('health.created',hid,{animal_id:animalId,date,symptoms,status,cost});
  }

  // ---- Vaccinations ----
  const vacs=[[b1,daysAgo(60),'Foot & Mouth Disease (FMD)',daysAhead(60),'FMD-B3-2201','Dr. Ali Raza',150,null],[b2,daysAgo(55),'Hemorrhagic Septicemia (HS)',daysAhead(65),'HS-1187','Dr. Ali Raza',150,null],[c1,daysAgo(10),'FMD booster',daysAhead(50),'FMD-B3-2210','Dr. Ali Raza',150,'Calf primary course']];
  for(const [animalId,date,vaccine,nextDue,batch,vet,cost,notes] of vacs){
   const vid=randomUUID();
   await client.query('INSERT INTO vaccinations(id,farm_id,animal_id,date,vaccine,next_due,batch,veterinarian,cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[vid,farmId,animalId,date,vaccine,nextDue,batch,vet,cost,notes]);
   await log('vaccinations.created',vid,{animal_id:animalId,date,vaccine,next_due:nextDue});
  }

  // ---- Breeding ----
  const breed=[[b1,daysAgo(45),'Insemination','Successful','Nili-Ravi bull #7','Naik Muhammad',daysAhead(300),null,1500,'First service'], [b1,daysAgo(90),'Heat','Unknown','-','Naik Muhammad',null,null,0,null], [b4,daysAgo(30),'Pregnancy check','Positive','-','Dr. Ali Raza',daysAhead(260),null,800,'In calf — expected calving'], [c1,daysAgo(40),'Calving','Successful',null,'Naik Muhammad',null,'C-01',0,'Birth recorded — heifer calf'], [b5,daysAgo(20),'Pregnancy check','Negative','-','Dr. Ali Raza',null,null,800,'Repeat insemination due']];
  for(const [animalId,date,event,result,bullName,tech,exp,calfTag,cost,notes] of breed){
   const bId=randomUUID();
   await client.query('INSERT INTO breeding(id,farm_id,animal_id,date,event,result,bull,technician,expected_date,calf_tag,cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[bId,farmId,animalId,date,event,result,bullName,tech,exp,calfTag,cost,notes]);
   await log('breeding.created',bId,{animal_id:animalId,date,event,result,cost});
  }

  // ---- Staff (created before tasks since tasks.assignee references staff) ----
  const staffMap:Record<string,string>={};
  const staffList:[string,string,string,number,string,string][]=[['Naik Muhammad','0302-1112223','Head Milker',3,'Active','Lead all milking teams'],['Imran Khan','0345-6667778','Calf & Shed Attendant',1,'Active','Calf rearing and shed hygiene'],['Muhammad Yousaf','0314-5556667','Feed Supervisor',5,'Active','Feed ration and inventory'],['Abdul Rehman','0306-4445556','Guard',6,'Inactive','Left service']];
  for(const [name,phone,position,years,status,notes] of staffList){
   const sId=randomUUID();staffMap[name]=sId;
   await client.query('INSERT INTO staff(id,farm_id,name,phone,position,joining_date,salary,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[sId,farmId,name,phone,position,yearsAgo(years),status==='Active'?25000:15000,status,'Active'===status?notes:notes+' (inactive)']);
   await log('staff.created',sId,{name,position,status});
  }

  // ---- Tasks ----
  const tasks=[['Morning milking round',daysAgo(0),staffMap['Naik Muhammad'],null,'Normal','Completed','Complete all milking sessions'],['Buy fodder (wheat straw)',daysAhead(1),staffMap['Muhammad Yousaf'],null,'High','Assigned','Order 500kg from supplier'],['Vet follow-up on B-06 mastitis',daysAhead(1),staffMap['Naik Muhammad'],b6,'Urgent','Assigned','Check udder and decide next dose'],['Clean calf pens',daysAgo(0),staffMap['Imran Khan'],c1,'Normal','Verified','Daily bedding change'],['Check heifer pen fencing',daysAhead(3),staffMap['Imran Khan'],null,'Normal','Assigned','Inspect and repair']];
  for(const [title,date,assignee,animalId,priority,status,notes] of tasks){
   const tId=randomUUID();
   await client.query('INSERT INTO tasks(id,farm_id,title,date,assignee,animal_id,priority,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[tId,farmId,title,date,assignee,animalId,priority,status,notes]);
   await log('tasks.created',tId,{title,date,priority,status,assignee});
  }

  // ---- Buyers / Suppliers / Partners ----
  await client.query('INSERT INTO partners(id,farm_id,name,phone,investment_date,agreement,notes) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),farmId,'Ahmed Nawaz','0322-1234321',yearsAgo(1),'Land and shed lease partner','Infrastructure partner']);

  // ---- Inventory ----
  const inv=[['Wheat straw','Feed','kg',500,'Feed store',4500,13500],['Buffalo ration 18%','Feed','kg',800,'Feed store',1200,96000],['Green fodder (berseem)','Feed','kg',300,'Feed store',800,4000],['FMD vaccine','Vaccine','dose',100,'Medicine fridge',180,36000],['Amoxicillin 10%','Medicine','dose',60,'Medicine fridge',90,2250],['Mastitis gel','Medicine','piece',20,'Medicine fridge',25,750],['Milking bucket (stainless)','Equipment','piece',5,'Tool shed',10,12000],['Disinfectant spray','Supplies','litre',25,'Store room',40,3000]];
  for(const [name,category,unit,minStock,storage,stockQ,stockV] of inv){
   const iId=randomUUID();
   await client.query('INSERT INTO inventory(id,farm_id,name,category,unit,minimum_stock,storage,notes,stock_quantity,stock_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[iId,farmId,name,category,unit,minStock,storage,null,stockQ,stockV]);
   await log('inventory.created',iId,{name,category,unit,minimum_stock:minStock,stock_quantity:stockQ});
  }

  await client.query('COMMIT');
  console.log('Al-Noor Dairy Farm seeded successfully across all modules.');
  console.log('Login: demo@alnoor.invalid / Demo-password-123');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await db.end();}
}
main().catch(e=>{console.error('Seed failed:',e);process.exit(1)});
