import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import pino from 'pino';
import QRCode from 'qrcode';
import type {AuthenticationState,ConnectionState,WASocket} from '@whiskeysockets/baileys' with {'resolution-mode':'import'};
import {createWhatsAppAuth,whatsappEncryptionKey} from './whatsapp-auth';
import {DomainError} from './operations';

type SocketFactory=(state:AuthenticationState)=>Promise<WASocket>;
type Auth=Awaited<ReturnType<typeof createWhatsAppAuth>>;
type Entry={farm:string;generation:string;auth:Auth;socket?:WASocket;stopped:boolean;attempts:number;qr?:string;expires?:number;retry?:NodeJS.Timeout;pairing?:NodeJS.Timeout};
async function makeSocket(auth:AuthenticationState):Promise<WASocket>{
 const {default:makeWASocket,Browsers}=await import('@whiskeysockets/baileys');
 return makeWASocket({auth,logger:pino({level:'silent'}),browser:Browsers.ubuntu('DairyMonitor'),markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,getMessage:async()=>undefined,connectTimeoutMs:30000,defaultQueryTimeoutMs:30000,qrTimeout:60000});
}

export class WhatsAppService {
 private entries=new Map<string,Entry>();
 private queues=new Map<string,Promise<unknown>>();
 private leasePromise?:Promise<PoolClient>;
 private held=new Set<string>();
 private leaseError?:()=>void;
 private stopping=false;
 private monitor?:NodeJS.Timeout;
 constructor(private pool:Pool,private socketFactory:SocketFactory=makeSocket,private keyProvider=whatsappEncryptionKey){}
 configured(){try{this.keyProvider();return true}catch{return false}}
 private serial<T>(farm:string,task:()=>Promise<T>):Promise<T>{
  const next=(this.queues.get(farm)||Promise.resolve()).then(task);
  const settled=next.catch(()=>{});this.queues.set(farm,settled);
  void settled.then(()=>{if(this.queues.get(farm)===settled)this.queues.delete(farm)});
  return next;
 }
 private current(entry:Entry){return !this.stopping&&!entry.stopped&&this.entries.get(entry.farm)===entry}
 private async lease(){
  if(!this.leasePromise)this.leasePromise=this.pool.connect().then(client=>{
   const onError=()=>{
    this.leasePromise=undefined;this.held.clear();
    for(const entry of this.entries.values()){this.stopSocket(entry);entry.stopped=true}
    this.entries.clear();client.removeListener('error',onError);try{client.release(true)}catch{}
   };this.leaseError=onError;client.on('error',onError);return client;
  }).catch(error=>{this.leasePromise=undefined;throw error});
  return this.leasePromise;
 }
 private async lock(farm:string){
  if(this.held.has(farm))return;
  const client=await this.lease();
  const {rows}=await client.query('SELECT pg_try_advisory_lock(843929,hashtext($1)) AS locked',[farm]);
  if(!rows[0].locked)throw new DomainError(409,'This WhatsApp connection is active on another server. Try again shortly.');
  this.held.add(farm);
 }
 private async unlock(farm:string){
  if(!this.held.delete(farm)||!this.leasePromise)return;
  await (await this.leasePromise).query('SELECT pg_advisory_unlock(843929,hashtext($1))',[farm]);
 }
 private stopSocket(entry:Entry){
  clearTimeout(entry.retry);clearTimeout(entry.pairing);entry.qr=undefined;entry.expires=undefined;
  const socket=entry.socket;entry.socket=undefined;
  if(socket){socket.ev.removeAllListeners('connection.update');socket.ev.removeAllListeners('creds.update');void socket.end(undefined).catch(()=>{})}
 }
 private async update(entry:Entry,status:string,error:string|null=null){
  await this.pool.query('UPDATE whatsapp_connections SET status=$3,last_error=$4,updated_at=now() WHERE farm_id=$1 AND generation=$2',[entry.farm,entry.generation,status,error]);
 }
 async status(farm:string){
  const row=(await this.pool.query('SELECT status,phone_number,account_name,last_error,linked_at,updated_at,enabled FROM whatsapp_connections WHERE farm_id=$1',[farm])).rows[0];
  const entry=this.entries.get(farm),validQR=entry?.qr&&entry.expires&&entry.expires>Date.now();
  // Never return serialized authentication state or an expired pairing code.
  const interrupted=row?.enabled&&!entry&&['connected','connecting','qr','reconnecting'].includes(row.status);
  return {configured:this.configured(),status:interrupted?'error':row?.status||'disconnected',phone_number:row?.phone_number||null,account_name:row?.account_name||null,last_error:interrupted?'Connection interrupted. Click Link WhatsApp to reconnect.':row?.last_error||null,linked_at:row?.linked_at||null,updated_at:row?.updated_at||null,qr_data_url:validQR?entry.qr:null,qr_expires_at:validQR?new Date(entry.expires!).toISOString():null};
 }
 async connect(farm:string,user:string){
  if(this.stopping)throw new DomainError(503,'WhatsApp service is restarting. Try again shortly.');
  if(!this.configured())throw new DomainError(503,'WhatsApp linking is not available on this server. Contact the platform administrator.');
  return this.serial(farm,async()=>{
   if(this.entries.has(farm))return this.status(farm);
   await this.lock(farm);
   try{
    const row=(await this.pool.query("INSERT INTO whatsapp_connections(farm_id,generation,linked_by,status) VALUES($1,$2,$3,'connecting') ON CONFLICT(farm_id) DO UPDATE SET enabled=true,linked_by=excluded.linked_by,status='connecting',last_error=NULL,updated_at=now() RETURNING generation",[farm,randomUUID(),user])).rows[0];
    const auth=await createWhatsAppAuth(this.pool,farm,row.generation,this.keyProvider());
    await auth.saveCreds();
    const entry:Entry={farm,generation:row.generation,auth,stopped:false,attempts:0};this.entries.set(farm,entry);
    if(!auth.state.creds.registered)entry.pairing=setTimeout(()=>{void this.serial(farm,()=>this.fail(entry,'Pairing expired. Click Link WhatsApp to generate a new QR code.')).catch(()=>{})},180000);
    await this.open(entry);return this.status(farm);
   }catch(error){
    const entry=this.entries.get(farm);if(entry){this.stopSocket(entry);entry.stopped=true;this.entries.delete(farm)}
    await this.pool.query("UPDATE whatsapp_connections SET status='error',last_error='Unable to start WhatsApp. Try again or unlink and reconnect.',updated_at=now() WHERE farm_id=$1",[farm]);
    await this.unlock(farm);throw new DomainError(503,'Unable to start WhatsApp. Try again or unlink and reconnect.');
   }
  });
 }
 private async open(entry:Entry){
  if(!this.current(entry))return;
  const socket=await this.socketFactory(entry.auth.state);
  if(!this.current(entry)){await socket.end(undefined);return}
  entry.socket=socket;
  socket.ev.on('creds.update',changes=>{
   if(!this.current(entry)||entry.socket!==socket)return;
   Object.assign(entry.auth.state.creds,changes);
   void entry.auth.saveCreds().catch(()=>this.serial(entry.farm,()=>this.fail(entry,'Unable to save the WhatsApp connection. Please reconnect.'))).catch(()=>{});
  });
  socket.ev.on('connection.update',event=>{
   void this.serial(entry.farm,async()=>{if(this.current(entry)&&entry.socket===socket)await this.onUpdate(entry,event)}).catch(()=>this.serial(entry.farm,()=>this.fail(entry,'WhatsApp connection failed. Please reconnect.'))).catch(()=>{});
  });
 }
 private async onUpdate(entry:Entry,event:Partial<ConnectionState>){
  if(event.qr){entry.qr=await QRCode.toDataURL(event.qr,{width:300,margin:2,errorCorrectionLevel:'M'});entry.expires=Date.now()+55000;await this.update(entry,'qr')}
  if(event.connection==='open'){
   clearTimeout(entry.pairing);entry.qr=undefined;entry.expires=undefined;entry.attempts=0;
   await entry.auth.saveCreds();
   const account=entry.socket?.user||entry.auth.state.creds.me;
   const digits=account?.id?.split('@')[0]?.split(':')[0];
   const phone=digits&&/^\d{7,15}$/.test(digits)?'+'+digits:null;
   await this.pool.query("UPDATE whatsapp_connections SET status='connected',phone_number=$3,account_name=$4,last_error=NULL,linked_at=now(),updated_at=now() WHERE farm_id=$1 AND generation=$2",[entry.farm,entry.generation,phone,account?.name||null]);
  }
  if(event.connection==='close'){
   const code=(event.lastDisconnect?.error as {output?:{statusCode?:number}}|undefined)?.output?.statusCode;
   entry.qr=undefined;entry.expires=undefined;
   const socket=entry.socket;entry.socket=undefined;socket?.ev.removeAllListeners('connection.update');socket?.ev.removeAllListeners('creds.update');
   await entry.auth.flush();
   if([401,403,411,440,500].includes(code||0)){
    await this.fail(entry,code===401?'WhatsApp was unlinked from the phone. Link it again to reconnect.':'WhatsApp requires a new link. Click Link WhatsApp to scan a fresh QR code.',true);return;
   }
   if((entry.auth.state.creds.registered||code===515)&&entry.attempts<5){
    entry.attempts++;await this.update(entry,'reconnecting');
    entry.retry=setTimeout(()=>{void this.serial(entry.farm,()=>this.open(entry)).catch(()=>this.serial(entry.farm,()=>this.fail(entry,'Unable to reconnect to WhatsApp. Please try again.'))).catch(()=>{})},code===515?500:Math.min(30000,1000*2**entry.attempts));
   }else await this.fail(entry,'Could not connect to WhatsApp. Check the server internet connection and try again.');
  }
 }
 private async fail(entry:Entry,message:string,clear=false){
  if(!this.current(entry))return;
  entry.stopped=true;this.stopSocket(entry);
  await entry.auth.flush();
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   await client.query("UPDATE whatsapp_connections SET enabled=false,status='error',last_error=$3,updated_at=now() WHERE farm_id=$1 AND generation=$2",[entry.farm,entry.generation,message]);
   if(clear){
    await client.query('DELETE FROM whatsapp_auth WHERE farm_id=$1 AND generation=$2',[entry.farm,entry.generation]);
    await client.query('UPDATE whatsapp_connections SET generation=$3 WHERE farm_id=$1 AND generation=$2',[entry.farm,entry.generation,randomUUID()]);
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  this.entries.delete(entry.farm);
  await this.unlock(entry.farm);
 }
 async disconnect(farm:string){
  return this.serial(farm,async()=>{
   await this.lock(farm);
   const entry=this.entries.get(farm);let remoteLogout=false;
   if(entry){entry.stopped=true;clearTimeout(entry.retry);clearTimeout(entry.pairing);
    if(entry.socket){try{await Promise.race([entry.socket.logout(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('timeout')),5000);timer.unref()})]);remoteLogout=true}catch{}}
    this.stopSocket(entry);await entry.auth.flush();this.entries.delete(farm);
   }
   try{await this.pool.query('DELETE FROM whatsapp_connections WHERE farm_id=$1',[farm])}finally{await this.unlock(farm)}
   return {...await this.status(farm),remote_logout:remoteLogout};
  });
 }
 async restore(){
  if(!this.configured())return;
  const rows=(await this.pool.query("SELECT w.farm_id,w.linked_by FROM whatsapp_connections w JOIN farms f ON f.id=w.farm_id JOIN users u ON u.id=w.linked_by JOIN farm_members m ON m.farm_id=w.farm_id AND m.user_id=w.linked_by WHERE w.enabled=true AND f.is_active=true AND u.is_active=true AND m.status='Active' AND m.role='OWNER'")).rows;
  for(const row of rows){try{await this.connect(row.farm_id,row.linked_by)}catch{console.warn('WhatsApp reconnect deferred for farm',row.farm_id)}}
  this.monitor=setInterval(()=>{void this.checkAccess().catch(()=>{})},60000);this.monitor.unref();
 }
 private async checkAccess(){
  for(const entry of this.entries.values()){
   const allowed=(await this.pool.query("SELECT 1 FROM whatsapp_connections w JOIN farms f ON f.id=w.farm_id JOIN users u ON u.id=w.linked_by JOIN farm_members m ON m.farm_id=w.farm_id AND m.user_id=w.linked_by WHERE w.farm_id=$1 AND w.enabled=true AND f.is_active=true AND u.is_active=true AND m.status='Active' AND m.role='OWNER'",[entry.farm])).rowCount;
   if(!allowed)await this.serial(entry.farm,()=>this.fail(entry,'Connection paused because farm or administrator access changed.'));
  }
 }
 async shutdown(){
  this.stopping=true;clearInterval(this.monitor);
  for(const entry of this.entries.values()){entry.stopped=true;this.stopSocket(entry);await entry.auth.flush()}
  this.entries.clear();await Promise.allSettled(this.queues.values());
  if(this.leasePromise){try{const client=await this.leasePromise;await client.query('SELECT pg_advisory_unlock_all()');if(this.leaseError)client.removeListener('error',this.leaseError);client.release()}catch{}}
  this.leasePromise=undefined;this.held.clear();
 }
}
