import EmbeddedPostgres from 'embedded-postgres';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {db} from '../src/db';

async function applyMigrations(){
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(843928)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files=(await readFile('database/001_initial.sql','utf8'));
  if(!(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',['001_initial.sql'])).rowCount){
   await client.query(files);
   await client.query('INSERT INTO schema_migrations(name) VALUES($1)',['001_initial.sql']);
  }
  const ops=await readFile('database/002_operations.sql','utf8');
  if(!(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',['002_operations.sql'])).rowCount){
   await client.query(ops);
   await client.query('INSERT INTO schema_migrations(name) VALUES($1)',['002_operations.sql']);
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function main(){
 const pg=new EmbeddedPostgres({databaseDir:'.local-db',user:'dairymonitor',password:'dairymonitor_local',port:5432,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:console.error});
 if(!existsSync('.local-db/PG_VERSION'))await pg.initialise();
 await pg.start();
 const client=pg.getPgClient('postgres');await client.connect();
 const check=await client.query("SELECT 1 FROM pg_database WHERE datname='dairymonitor'");
 if(!check.rowCount)await client.query('CREATE DATABASE dairymonitor');
 await client.end();
 await applyMigrations().catch(async e=>{try{await pg.stop();}catch{}throw e;});
 console.log('Embedded PostgreSQL ready on 127.0.0.1:5432');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await pg.stop();process.exit(0)});
 setInterval(()=>{},60000);
}
main().catch(e=>{console.error(e);process.exit(1)});
