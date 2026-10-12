/** Disposable test instance only. Never run against the live database. */
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
const url=process.env.BACKUP_TEST_DATABASE_URL,base=process.env.BACKUP_TEST_API_URL,origin=process.env.BACKUP_TEST_ORIGIN,restore=process.env.PG_RESTORE_PATH;
if(!url||!base||!origin||!restore)throw Error('Explicit disposable database/API/origin and PG_RESTORE_PATH required');
const db=new pg.Client({connectionString:url});let cookie='';
async function raw(path:string,method='GET',body?:unknown){return fetch(base+path,{method,headers:{Origin:origin!,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)})}
async function call(path:string,method='GET',body?:unknown,status=200){const r=await raw(path,method,body);assert.equal(r.status,status,await r.clone().text());return r.json() as Promise<any>}
async function main(){await db.connect();try{
 const signup=await raw('/auth/register','POST',{name:'Backup test admin',email:randomUUID()+'@example.invalid',password:'backup-test-123'});assert.equal(signup.status,201);cookie=signup.headers.get('set-cookie')!.split(';')[0];const user=await signup.json() as {id:string};
 await call('/admin/backups','GET',undefined,403);await call('/admin/backup','POST',undefined,403);await call('/admin/backups/dairymonitor_test.tar.gz','DELETE',undefined,403);
 await db.query('UPDATE users SET is_superadmin=true WHERE id=$1',[user.id]);
 const farm=await call('/farms','POST',{name:'Backup fixture',city:'Lahore',currency:'PKR'},201),staff=randomUUID(),photo='data:image/png;base64,aGVsbG8=';
 await db.query("INSERT INTO staff(id,farm_id,name,status,photo) VALUES($1,$2,'Photo fixture','Active',$3)",[staff,farm.id,photo]);
 await call('/admin/backup','POST',undefined,202);let data:any;
 for(let i=0;i<120;i++){data=await call('/admin/backups');if(data.job?.status!=='running')break;await new Promise(r=>setTimeout(r,250))}
 assert.equal(data.job.status,'complete',data.job.error);const file=data.job.file;assert.ok(data.files.some((f:any)=>f.file===file));
 const response=await raw('/admin/backups/'+file);assert.equal(response.status,200);const archive=Buffer.from(await response.arrayBuffer()),temp=await mkdtemp('/tmp/dairyfarm-restore-check-');await writeFile(temp+'/backup.tar.gz',archive,{mode:0o600});execFileSync('tar',['-xzf',temp+'/backup.tar.gz','-C',temp]);
 const manifest=JSON.parse(await readFile(temp+'/manifest.json','utf8'));assert.equal(manifest.database.sha256,createHash('sha256').update(await readFile(temp+'/database.dump')).digest('hex'));assert.equal(await readFile(temp+'/uploads/0/test-file.txt','utf8'),'Uploaded file backup fixture');
 const name='restore_'+randomUUID().replaceAll('-','');await db.query('CREATE DATABASE "'+name+'"');const target=new URL(url!);target.pathname='/'+name;
 execFileSync(restore!,['--no-owner','--no-acl','--exit-on-error','--dbname',target.toString(),temp+'/database.dump'],{stdio:'pipe'});
 const restored=new pg.Client({connectionString:target.toString()});await restored.connect();try{assert.equal((await restored.query('SELECT photo FROM staff WHERE id=$1',[staff])).rows[0].photo,photo);assert.equal((await restored.query('SELECT name FROM farms WHERE id=$1',[farm.id])).rows[0].name,'Backup fixture');assert.ok((await restored.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count>=24)}finally{await restored.end()}
 await call('/admin/backups/'+file,'DELETE');assert.equal((await raw('/admin/backups/'+file)).status,404);assert.equal((await call('/admin/backups')).files.some((f:any)=>f.file===file),false);
 assert.equal((await db.query('SELECT photo FROM staff WHERE id=$1',[staff])).rows[0].photo,photo);
 await call('/admin/backups/not-a-backup','DELETE',undefined,400);
 console.log('PASS: superadmin-only create/download/delete, complete archive, uploaded file bytes, checksum, restore into empty database, embedded photo, schema, live-data preservation and filename validation.');
}finally{await db.end()}}
main().catch(error=>{console.error(error);process.exitCode=1});
