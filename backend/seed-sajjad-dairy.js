const {Client}=require('pg');
const {randomUUID}=require('crypto');

const email=process.env.SEED_EMAIL;
const farmName=process.env.SEED_FARM_NAME;
if(!email||!farmName)throw new Error('Set SEED_EMAIL and SEED_FARM_NAME for an existing farm owner');
const today=new Date();
const dayMs=86400000;
const iso=d=>d.toISOString().slice(0,10);

const names=['Gulabo','Chandni','Rani','Moti','Noori','Lali','Sundari','Heera','Sassi','Meena','Kiran','Billo','Nili','Barkat','Sohni','Roshan','Dhanak','Surmai','Badal','Sitara','Gori','Malka','Pinki','Shama','Resham','Bano','Asha','Ruby','Pearl','Amber','Luna','Daisy','Bella','Nora','Zara'];
const breeds=['Sahiwal','Nili-Ravi','Friesian','Jersey','Crossbred'];

async function main(){
 const client=new Client({connectionString:process.env.DATABASE_URL});
 await client.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`demo-month:${email}:${farmName}`]);
  const user=(await client.query('SELECT id,name FROM users WHERE email=$1',[email])).rows[0];
  if(!user)throw new Error(`User not found: ${email}`);
  const farms=(await client.query("SELECT f.id FROM farms f JOIN farm_members fm ON fm.farm_id=f.id WHERE fm.user_id=$1 AND f.name=$2 AND fm.role='OWNER' AND fm.status='Active'",[user.id,farmName])).rows;
  if(farms.length!==1)throw new Error('Expected exactly one matching farm owned by this user');
  const farm=farms[0];
  const farmId=farm.id;
  const marker='demo.seeded.month.v1';
  if((await client.query('SELECT 1 FROM audit_logs WHERE farm_id=$1 AND action=$2',[farmId,marker])).rowCount){
   await client.query('ROLLBACK');
   console.log(JSON.stringify({ok:true,skipped:true,reason:'Monthly demo already added'}));
   return;
  }

  const staff=[];
  for(const s of [['Ali Raza','Herd Manager'],['Bilal Khan','Milking Supervisor'],['Usman Ahmed','Farm Worker']]){
   const id=randomUUID();staff.push(id);
   await client.query('INSERT INTO staff(id,farm_id,name,phone,position,joining_date,salary,status,email) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,farmId,s[0],'0300'+Math.floor(1000000+Math.random()*8999999),s[1],iso(new Date(today.getTime()-120*dayMs)),45000,'Active',`${s[0].toLowerCase().replaceAll(' ','.')}@example.com`]);
  }

  const animals=[];
  for(let i=0;i<35;i++){
   const id=randomUUID(), female=i<30, lactating=i<22;
   animals.push({id,lactating});
   await client.query('INSERT INTO animals(id,farm_id,tag,name,species,breed,sex,birth_date,stage,production_status,reproductive_status,health_status,disposition,location,rfid,purchase_date,purchase_price,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',[
    id,farmId,`DEMO-${String(i+1).padStart(3,'0')}`,names[i],'Cattle',breeds[i%breeds.length],female?'Female':'Male',iso(new Date(today.getTime()-(900+i*35)*dayMs)),'Adult',lactating?'Lactating':female?'Dry':'Not producing',female&&i%4===0?'Pregnant':'Open',i%17===0?'Under treatment':'Healthy','Active',`Demo Shed ${1+i%4}`,`DEMO-RFID-${1000+i}`,iso(new Date(today.getTime()-(240+i*3)*dayMs)),160000+i*3500,'Seed demo animal'
   ]);
  }

  for(const a of animals.filter(x=>x.lactating)){
   for(let d=29;d>=0;d--){
    for(const session of ['Morning','Evening']){
     const q=(session==='Morning'?8:6)+(Number(a.id.charCodeAt(0))%4)+Math.random()*2;
     await client.query('INSERT INTO milk(id,farm_id,animal_id,date,session,quantity,fat,snf,destination,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),farmId,a.id,iso(new Date(today.getTime()-d*dayMs)),session,Number(q.toFixed(2)),3.8,8.6,'Tank','One month demo milk record']);
    }
   }
  }

  for(const a of animals.slice(0,20)){
   await client.query('INSERT INTO weights(id,farm_id,animal_id,date,weight,body_condition,notes) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),farmId,a.id,iso(new Date(today.getTime()-(Math.floor(Math.random()*25))*dayMs)),360+Math.floor(Math.random()*180),3.5,'Monthly sample weight']);
  }
  for(const a of animals.slice(0,8)){
   await client.query('INSERT INTO health(id,farm_id,animal_id,date,symptoms,diagnosis,veterinarian,medicine,dose,end_date,follow_up,milk_withdrawal_until,meat_withdrawal_until,status,cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[randomUUID(),farmId,a.id,iso(new Date(today.getTime()-(2+a.id.charCodeAt(0)%20)*dayMs)),'Reduced appetite','Routine treatment','Dr. Hamid','Mineral supplement','50 ml',iso(today),iso(new Date(today.getTime()+7*dayMs)),null,null,'Active',1500,'Demo health entry']);
  }
  for(const a of animals.slice(8,20)){
   await client.query('INSERT INTO vaccinations(id,farm_id,animal_id,date,vaccine,next_due,batch,veterinarian,cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),farmId,a.id,iso(new Date(today.getTime()-(a.id.charCodeAt(0)%28)*dayMs)),'FMD Vaccine',iso(new Date(today.getTime()+150*dayMs)),'FMD-2026-A','Dr. Hamid',900,'Demo vaccination']);
  }
  for(const a of animals.slice(0,12)){
   await client.query('INSERT INTO breeding(id,farm_id,animal_id,date,event,result,bull,technician,expected_date,cost,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[randomUUID(),farmId,a.id,iso(new Date(today.getTime()-(a.id.charCodeAt(0)%30)*dayMs)),'Pregnancy check',a.id.charCodeAt(0)%2?'Positive':'Unknown','Bull A','Ali Raza',iso(new Date(today.getTime()+180*dayMs)),1200,'Demo breeding record']);
  }

  for(const b of [['Punjab Milk Traders','03111111111','Lahore',210],['Fresh Dairy Buyer','03222222222','Kasur',205]]){
   await client.query('INSERT INTO buyers(id,farm_id,name,phone,address,rate,payment_cycle,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),farmId,b[0],b[1],b[2],b[3],'Weekly','Demo buyer']);
  }
  for(const s of [['Green Feed Supplies','03333333333','Silage and concentrate','Weekly'],['VetCare Pharmacy','03444444444','Medicine and vaccines','Cash']]){
   await client.query('INSERT INTO suppliers(id,farm_id,name,phone,address,products,payment_terms,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),farmId,s[0],s[1],'Lahore',s[2],s[3],'Demo supplier']);
  }
  for(const item of [['Silage','Feed','kg',500,3200,192000],['Mineral Mix','Feed','kg',25,75,22500],['FMD Vaccine','Vaccine','dose',20,45,18000],['Antibiotic','Medicine','dose',10,22,15400]]){
   await client.query('INSERT INTO inventory(id,farm_id,name,category,unit,minimum_stock,storage,stock_quantity,stock_value,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),farmId,item[0],item[1],item[2],item[3],'Main store',item[4],item[5],'Demo inventory']);
  }
  for(let d=0;d<12;d++){
   await client.query('INSERT INTO tasks(id,farm_id,title,date,assignee,priority,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),farmId,d%2?'Vaccination follow-up':'Shed cleaning',iso(new Date(today.getTime()+(d-4)*dayMs)),staff[d%staff.length],d%3?'Normal':'High',d<4?'Completed':'Assigned','Demo task']);
  }
  await client.query('INSERT INTO audit_logs(id,farm_id,user_id,action) VALUES($1,$2,$3,$4)',[randomUUID(),farmId,user.id,marker]);
  await client.query('COMMIT');
  console.log(JSON.stringify({ok:true,user:email,farm:farmName,animals:35,days:30}));
 }catch(e){
  await client.query('ROLLBACK');
  throw e;
 }finally{
  await client.end();
 }
}

main().catch(e=>{console.error(e);process.exit(1);});
