/** Disposable database only. Socket lifecycle tests use a fake transport; optional QR smoke uses real WhatsApp. */
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import type {AuthenticationState,WASocket} from '@whiskeysockets/baileys' with {'resolution-mode':'import'};
import {WhatsAppService} from '../src/modules/whatsapp-service';
const url=process.env.WA_TEST_DATABASE_URL,base=process.env.WA_TEST_API_URL,origin=process.env.WA_TEST_ORIGIN;
if(!url||!base||!origin)throw new Error('Set WA_TEST_DATABASE_URL, WA_TEST_API_URL and WA_TEST_ORIGIN for a disposable instance');
const pool=new pg.Pool({connectionString:url});const key=randomBytes(32);let cookie='';
async function api(path:string,method='GET',data?:unknown,expected=200){const r=await fetch(base+path,{method,headers:{Origin:origin!,'Content-Type':'application/json',Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data)});const body=await r.json() as {id:string;status:string;qr_data_url:string|null;last_error:string};assert.equal(r.status,expected,path+': '+JSON.stringify(body));return {body,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
async function owner(){const r=await api('/auth/register','POST',{name:'WhatsApp Test Owner',email:`wa-${randomUUID()}@example.invalid`,password:'WhatsApp-test-123'},201);cookie=r.cookie!;const farm=(await api('/farms','POST',{name:'WhatsApp Test Farm',city:'Lahore',currency:'PKR'},201)).body;return {user:r.body,farm,cookie}}
async function until(check:()=>Promise<boolean>,message:string){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,30))}throw new Error(message)}
const sockets:{ev:EventEmitter;auth:AuthenticationState;user:{id:string;name:string};ended:boolean;loggedOut:boolean}[]=[];
async function fake(auth:AuthenticationState){const item={ev:new EventEmitter(),auth,user:{id:'923001234567:1@s.whatsapp.net',name:'Test Dairy'},ended:false,loggedOut:false};sockets.push(item);return {...item,end:async()=>{item.ended=true},logout:async()=>{item.loggedOut=true}} as unknown as WASocket}
async function main(){let service=new WhatsAppService(pool,fake,()=>key),otherService=new WhatsAppService(pool,fake,()=>key);
try{
 const a=await owner(),b=await owner();cookie=a.cookie;const path='/farms/'+a.farm.id+'/settings/whatsapp';
 await api('/farms/'+b.farm.id+'/settings/whatsapp','GET',undefined,404);
 await pool.query("INSERT INTO farm_members(farm_id,user_id,role) VALUES($1,$2,'VIEWER')",[a.farm.id,b.user.id]);cookie=b.cookie;
 await api(path,'GET',undefined,403);await api(path+'/connect','POST',{},403);await api(path+'/disconnect','POST',{},403);cookie=a.cookie;
 assert.equal((await api(path)).body.status,'disconnected');
 await Promise.all([service.connect(a.farm.id,a.user.id),service.connect(a.farm.id,a.user.id)]);assert.equal(sockets.length,1);
 await service.connect(b.farm.id,b.user.id);assert.equal(sockets.length,2);
 await assert.rejects(()=>otherService.connect(a.farm.id,a.user.id),/another server/);
 const first=sockets[0],second=sockets[1];first.ev.emit('connection.update',{qr:'test-qr-for-farm-a'});
 await until(async()=>!!(await service.status(a.farm.id)).qr_data_url,'QR not generated');assert.equal((await service.status(b.farm.id)).qr_data_url,null);
 const exposed=JSON.stringify(await service.status(a.farm.id));assert.equal(exposed.includes('encrypted_value'),false);assert.equal(exposed.includes('noiseKey'),false);
 const credentials=(await pool.query('SELECT farm_id,encrypted_value FROM whatsapp_auth')).rows;assert.ok(credentials.length>=2);assert.ok(credentials.every(c=>c.encrypted_value.startsWith('v1.')&&!c.encrypted_value.includes('noiseKey')));
 first.ev.emit('creds.update',{registered:true,me:first.user});first.ev.emit('connection.update',{connection:'open'});
 await until(async()=>(await service.status(a.farm.id)).status==='connected','Connection not recorded');assert.equal((await service.status(a.farm.id)).phone_number,'+923001234567');assert.equal((await service.status(a.farm.id)).qr_data_url,null);
 await first.auth.keys.set({'pre-key':{'1':{private:Buffer.alloc(32,1),public:Buffer.alloc(32,2)}}});const stored=await first.auth.keys.get('pre-key',['1']);assert.ok(Buffer.isBuffer(stored['1'].private));assert.equal(stored['1'].private[0],1);
 first.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:515}}}});
 await until(async()=>sockets.length===3,'Restart-required was not handled');assert.equal(sockets[2].auth.creds.registered,true);
 await service.shutdown();service=new WhatsAppService(pool,fake,()=>key);await service.restore();assert.ok(sockets.some((s,i)=>i>=3&&s.auth.creds.registered));
 await service.disconnect(a.farm.id);assert.equal((await service.status(a.farm.id)).status,'disconnected');assert.equal((await pool.query('SELECT 1 FROM whatsapp_auth WHERE farm_id=$1',[a.farm.id])).rowCount,0);
 await first.auth.keys.set({'pre-key':{'stale':{private:Buffer.alloc(32),public:Buffer.alloc(32)}}});assert.equal((await pool.query('SELECT 1 FROM whatsapp_auth WHERE farm_id=$1',[a.farm.id])).rowCount,0);
 const currentB=sockets.slice(3).find(s=>!s.auth.creds.registered)!;currentB.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:401}}}});
 await until(async()=>(await service.status(b.farm.id)).status==='error','Logout was not detected');assert.equal((await pool.query('SELECT 1 FROM whatsapp_auth WHERE farm_id=$1',[b.farm.id])).rowCount,0);
 await service.connect(b.farm.id,b.user.id);await second.auth.keys.set({'pre-key':{'stale':{private:Buffer.alloc(32),public:Buffer.alloc(32)}}});assert.equal((await pool.query("SELECT 1 FROM whatsapp_auth WHERE farm_id=$1 AND key_id='stale'",[b.farm.id])).rowCount,0);
 await service.disconnect(b.farm.id);await service.shutdown();await otherService.shutdown();
 console.log('PASS: owner-only APIs, tenant isolation, separate encrypted credentials, QR isolation, duplicate connect, process leases, key serialization, restart/reconnect, unlink cleanup and stale-write prevention.');
 if(process.env.WA_TEST_NETWORK==='1'){
  cookie=a.cookie;await api(path+'/connect','POST',{},202);
  try{let success=false;for(let i=0;i<45;i++){const status=(await api(path)).body;if(status.qr_data_url){assert.match(status.qr_data_url,/^data:image\/png;base64,/);success=true;break}if(status.status==='error')throw new Error(status.last_error);await new Promise(resolve=>setTimeout(resolve,1000))}assert.ok(success,'Real WhatsApp QR was not received within 45 seconds');console.log('PASS: real Baileys connection received a QR code from WhatsApp (no phone linked and no messages sent).')}
  finally{await api(path+'/disconnect','POST',{})}
 }
}finally{await service.shutdown();await otherService.shutdown();await pool.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
