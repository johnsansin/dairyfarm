import assert from 'node:assert/strict';
import {db} from '../src/db';
const base='http://localhost:4000';const origin='http://localhost:3000';
async function call(path:string,method='GET',body?:unknown,cookie='',requestOrigin=origin){return fetch(base+'/api/v1'+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});}
async function main(){
 const run=Date.now();const password='Integration-password-123';
 const a=await call('/auth/register','POST',{name:'API owner A',email:`api-a-${run}@example.invalid`,password});assert.equal(a.status,201);const cookieA=a.headers.get('set-cookie')!.split(';')[0];const userA=await a.json();
 const b=await call('/auth/register','POST',{name:'API owner B',email:`api-b-${run}@example.invalid`,password});assert.equal(b.status,201);const cookieB=b.headers.get('set-cookie')!.split(';')[0];
 const f=await call('/farms','POST',{name:'API verification farm',city:'Lahore',currency:'PKR'},cookieA);assert.equal(f.status,201);const farm=await f.json() as {id:string};
 assert.equal((await call(`/farms/${farm.id}`,'GET',undefined,cookieA)).status,200);
 assert.equal((await call(`/farms/${farm.id}`,'GET',undefined,cookieB)).status,404);
 assert.deepEqual(await (await call('/farms','GET',undefined,cookieB)).json(),[]);
 assert.equal((await call('/farms')).status,401);
 assert.equal((await call('/farms','POST',{name:'Blocked',city:'Lahore',currency:'PKR'},cookieA,'https://untrusted.invalid')).status,403);
 assert.equal((await call('/farms','POST',{name:'',city:'Lahore',currency:'PKR'},cookieA)).status,400);
 assert.equal((await call('/auth/logout','POST',undefined,cookieA)).status,204);
 assert.equal((await call('/auth/me','GET',undefined,cookieA)).status,401);
 assert.equal((await call('/auth/login','POST',{email:(userA as {email:string}).email,password})).status,200);
 const audit=await db.query('SELECT action FROM audit_logs WHERE farm_id=$1',[farm.id]);assert.equal(audit.rows[0].action,'farm.created');
 const member=await db.query('SELECT role FROM farm_members WHERE farm_id=$1',[farm.id]);assert.equal(member.rows[0].role,'OWNER');
 console.log('PASS: registration, login, logout, session revocation, farm creation, tenant isolation, origin enforcement, validation, audit and membership integrity');await db.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
