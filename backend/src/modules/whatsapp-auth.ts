import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import type {AuthenticationState,SignalDataSet,SignalDataTypeMap} from '@whiskeysockets/baileys' with {'resolution-mode':'import'};

export function whatsappEncryptionKey(value=process.env.WHATSAPP_AUTH_KEY):Buffer {
 const key=Buffer.from(value||'','base64');
 if(key.length!==32)throw new Error('WhatsApp session encryption is not configured');
 return key;
}
export function sealWhatsApp(value:string,key:Buffer,context:string):string {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(context));
 const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');
}
export function openWhatsApp(value:string,key:Buffer,context:string):string {
 const [version,iv,tag,data]=value.split('.');
 if(version!=='v1'||!iv||!tag||!data)throw new Error('Invalid WhatsApp credential format');
 const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));
 cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64'));
 return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8');
}

export async function createWhatsAppAuth(pool:Pool,farm:string,generation:string,key:Buffer){
 const {BufferJSON,initAuthCreds,proto}=await import('@whiskeysockets/baileys');
 const context=(type:string,id:string)=>JSON.stringify([farm,generation,type,id]);
 let tail:Promise<unknown>=Promise.resolve();
 function serial<T>(task:()=>Promise<T>):Promise<T>{const next=tail.then(task);tail=next.catch(()=>{});return next}
 async function get(type:string,ids:string[]){
  await tail;
  if(!ids.length)return {};
  const rows=(await pool.query('SELECT key_id,encrypted_value FROM whatsapp_auth WHERE farm_id=$1 AND generation=$2 AND key_type=$3 AND key_id=ANY($4::text[])',[farm,generation,type,ids])).rows;
  return Object.fromEntries(rows.map(row=>[row.key_id,JSON.parse(openWhatsApp(row.encrypted_value,key,context(type,row.key_id)),BufferJSON.reviver)]));
 }
 function write(entries:{type:string;id:string;value:string|null}[]){
  return serial(async()=>{
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    // A stale socket cannot recreate credentials after unlinking or relinking.
    const active=await client.query('SELECT 1 FROM whatsapp_connections WHERE farm_id=$1 AND generation=$2 AND enabled=true FOR SHARE',[farm,generation]);
    if(active.rowCount)for(const item of entries){
     if(item.value===null)await client.query('DELETE FROM whatsapp_auth WHERE farm_id=$1 AND generation=$2 AND key_type=$3 AND key_id=$4',[farm,generation,item.type,item.id]);
     else await client.query('INSERT INTO whatsapp_auth(farm_id,generation,key_type,key_id,encrypted_value) VALUES($1,$2,$3,$4,$5) ON CONFLICT(farm_id,generation,key_type,key_id) DO UPDATE SET encrypted_value=excluded.encrypted_value,updated_at=now()',[farm,generation,item.type,item.id,sealWhatsApp(item.value,key,context(item.type,item.id))]);
    }
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  });
 }
 const creds=(await get('creds',['creds'])).creds||initAuthCreds();
 const state:AuthenticationState={creds,keys:{
  get:async<T extends keyof SignalDataTypeMap>(type:T,ids:string[])=>{
   const result=await get(type,ids);
   if(type==='app-state-sync-key')for(const id of Object.keys(result))result[id]=proto.Message.AppStateSyncKeyData.fromObject(result[id]);
   return result as {[id:string]:SignalDataTypeMap[T]};
  },
  set:async(data:SignalDataSet)=>{
   const entries=[];
   for(const [type,values] of Object.entries(data))for(const [id,value] of Object.entries(values||{}))entries.push({type,id,value:value?JSON.stringify(value,BufferJSON.replacer):null});
   await write(entries);
  }
 }};
 return {state,saveCreds:()=>write([{type:'creds',id:'creds',value:JSON.stringify(creds,BufferJSON.replacer)}]),flush:async()=>{await tail}};
}
