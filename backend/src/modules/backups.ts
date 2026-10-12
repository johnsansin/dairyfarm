import {Router} from 'express';
import path from 'node:path';
import {mkdir,mkdtemp,readdir,lstat,chmod,copyFile,writeFile,rename,rm,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {z} from 'zod';
import {db} from '../db';
import {DomainError} from './operations';
const directory=()=>path.resolve(process.env.BACKUP_DIR||'backups');
const fileName=z.string().regex(/^dairymonitor_[A-Za-z0-9.-]+\.(?:sql|tar\.gz)$/);
let job:{status:'running'|'complete'|'error';file?:string;error?:string;started:string}|null=null;
export const backupRouter=Router();
backupRouter.use((_req,res,next)=>{if(!res.locals.user?.is_superadmin)throw new DomainError(403,'Only platform superadmins can manage full backups');next()});
async function audit(user:string,action:string,file:string){await db.query('INSERT INTO admin_audit_logs(id,admin_user_id,action,record_type,detail) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user,action,'backup',JSON.stringify({file})])}
async function run(command:string,args:string[],env:NodeJS.ProcessEnv=process.env){
 await new Promise<void>((resolve,reject)=>{
  const child=spawn(command,args,{env,stdio:['ignore','ignore','pipe']});let stderr='';
  child.stderr.on('data',data=>{stderr=(stderr+String(data)).slice(-4000)});
  const timer=setTimeout(()=>child.kill('SIGTERM'),30*60*1000);
  child.once('error',()=>{clearTimeout(timer);reject(new Error('Backup utility unavailable. Configure PostgreSQL client and tar.'))});
  child.once('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error(stderr.includes('server version mismatch')?'PostgreSQL backup client is older than the database server.':'Backup archive could not be completed. Check database access, available disk space and upload files.'))});
 });
}
async function checksum(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')}
async function copyUploads(source:string,target:string,relative='',files:{path:string;size:number;sha256:string}[]=[]){
 const entries=await readdir(source,{withFileTypes:true});await mkdir(target,{recursive:true,mode:0o700});
 for(const entry of entries){const from=path.join(source,entry.name),to=path.join(target,entry.name),name=path.posix.join(relative,entry.name);
  if(entry.isSymbolicLink())throw new Error('An upload directory contains a symbolic link. Store uploaded files directly before backing up.');
  if(entry.isDirectory())await copyUploads(from,to,name,files);
  else if(entry.isFile()){await copyFile(from,to);await chmod(to,0o600);files.push({path:name,size:(await lstat(to)).size,sha256:await checksum(to)})}
 }
 return files;
}
async function createArchive(user:string){
 const client=await db.connect();let locked=false,stage:string|undefined;
 try{
  locked=Boolean((await client.query('SELECT pg_try_advisory_lock(843930) AS locked')).rows[0].locked);
  if(!locked)throw new Error('Another full backup is already running.');
  await mkdir(directory(),{recursive:true,mode:0o700});stage=await mkdtemp(path.join(directory(),'.building-'));
  const payload=path.join(stage,'payload');await mkdir(payload,{mode:0o700});
  const file='dairymonitor_'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.tar.gz';
  const localClient=path.resolve('.tools/postgres/usr/lib/postgresql/18/bin/pg_dump');
  const hasLocal=await lstat(localClient).then(s=>s.isFile()).catch(()=>false);
  const dump=process.env.PG_DUMP_PATH||(hasLocal?localClient:'pg_dump');
  const connection=new URL(process.env.DATABASE_URL!);const password=decodeURIComponent(connection.password)||connection.searchParams.get('password')||'';connection.password='';connection.searchParams.delete('password');
  const env={...process.env,PGPASSWORD:password,PGCONNECT_TIMEOUT:'15',...(hasLocal?{LD_LIBRARY_PATH:path.resolve('.tools/postgres/usr/lib/x86_64-linux-gnu')+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'')}:{})};
  await run(dump,['--dbname',connection.toString(),'--format=custom','--no-owner','--no-acl','--file',path.join(payload,'database.dump')],env);
  await chmod(path.join(payload,'database.dump'),0o600);
  const defaults=[path.resolve('uploads'),path.resolve('../uploads'),path.resolve('../frontend/public/uploads')];
  const configured=process.env.BACKUP_UPLOAD_DIRS?z.array(z.string().min(1)).parse(JSON.parse(process.env.BACKUP_UPLOAD_DIRS)).map(p=>path.resolve(p)):[];
  const uploads:{directory:string;archivePath:string;files:{path:string;size:number;sha256:string}[]}[]=[];
  for(const source of [...new Set([...defaults,...configured])]){
   const stat=await lstat(source).catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT'&&!configured.includes(source))return null;throw error});
   if(!stat)continue;
   if(!stat.isDirectory()||source===directory()||directory().startsWith(source+path.sep))throw new Error('Upload backup directory is invalid or contains the backup directory.');
   const archivePath='uploads/'+uploads.length;
   uploads.push({directory:source,archivePath,files:await copyUploads(source,path.join(payload,archivePath))});
  }
  const manifest={format:'dairymonitor-full-backup-v1',created:new Date().toISOString(),scope:'Entire application database and uploaded files',database:{file:'database.dump',sha256:await checksum(path.join(payload,'database.dump')),includes:'All schemas, tables, data, sequences, constraints and database-stored photos; PostgreSQL global roles excluded'},uploads,configuration:'Server environment secrets are not included. Preserve WHATSAPP_AUTH_KEY separately to restore encrypted WhatsApp sessions.'};
  await writeFile(path.join(payload,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  await writeFile(path.join(payload,'RESTORE.txt'),'Restore into an empty PostgreSQL database with a compatible pg_restore client:\npg_restore --no-owner --no-acl --exit-on-error --dbname=TARGET_DATABASE database.dump\n\nCopy each uploads/N directory back to its mapped location in manifest.json. Embedded photos are already in database.dump. Preserve server environment configuration, especially WHATSAPP_AUTH_KEY, separately. This archive contains private platform data; restrict access.\n',{mode:0o600});
  const archive=path.join(stage,file);await run('tar',['-czf',archive,'-C',payload,'.']);await chmod(archive,0o600);
  await audit(user,'backup.created',file);await rename(archive,path.join(directory(),file));
  job={status:'complete',file,started:job!.started};
 }catch(error){job={status:'error',error:error instanceof Error?error.message:'Backup failed',started:job!.started}}
 finally{if(stage)await rm(stage,{recursive:true,force:true}).catch(()=>{});if(locked)await client.query('SELECT pg_advisory_unlock(843930)').catch(()=>{});client.release()}
}
async function existing(value:unknown){const file=fileName.parse(value),target=path.join(directory(),file);const stat=await lstat(target).catch(()=>null);if(!stat?.isFile()||stat.isSymbolicLink())throw new DomainError(404,'Backup not found');return {file,target}}
backupRouter.post('/backup',async(_req,res)=>{
 if(job?.status==='running')throw new DomainError(409,'A backup is already being created.');
 job={status:'running',started:new Date().toISOString()};
 void createArchive(res.locals.user.id).catch(()=>{job={status:'error',error:'Could not start backup. Try again.',started:job!.started}});
 res.status(202).json({job});
});
backupRouter.get('/backups',async(_req,res)=>{
 await mkdir(directory(),{recursive:true,mode:0o700});const files=[];
 for(const file of await readdir(directory())){if(!fileName.safeParse(file).success)continue;const stat=await lstat(path.join(directory(),file)).catch(()=>null);if(stat?.isFile()&&!stat.isSymbolicLink())files.push({file,size:stat.size,created:stat.mtime.toISOString(),format:file.endsWith('.tar.gz')?'Full archive':'Legacy database data'})}
 res.json({files:files.sort((a,b)=>b.created.localeCompare(a.created)),job});
});
backupRouter.get('/backups/:file',async(req,res,next)=>{const {file,target}=await existing(req.params.file);await audit(res.locals.user.id,'backup.downloaded',file);res.download(target,file,{headers:{'Content-Type':file.endsWith('.tar.gz')?'application/gzip':'application/sql'}},error=>{if(error&&!res.headersSent)next(new DomainError(404,'Backup is no longer available'))})});
backupRouter.delete('/backups/:file',async(req,res)=>{const {file,target}=await existing(req.params.file);await audit(res.locals.user.id,'backup.deleted',file);await unlink(target);res.json({ok:true})});
