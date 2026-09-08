import EmbeddedPostgres from 'embedded-postgres';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
async function main(){
 const pg=new EmbeddedPostgres({databaseDir:'.local-db',user:'dairymonitor',password:'dairymonitor_local',port:5432,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:console.error});
 if(!existsSync('.local-db/PG_VERSION'))await pg.initialise();
 await pg.start();
 const client=pg.getPgClient('postgres');await client.connect();
 const check=await client.query("SELECT 1 FROM pg_database WHERE datname='dairymonitor'");
 if(!check.rowCount)await client.query('CREATE DATABASE dairymonitor');await client.end();
 const db=pg.getPgClient('dairymonitor');await db.connect();await db.query(await readFile('database/001_initial.sql','utf8'));await db.end();
 console.log('Local PostgreSQL ready on 127.0.0.1:5432');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await pg.stop();process.exit(0)});
 setInterval(()=>{},60000);
}
main().catch(e=>{console.error(e);process.exit(1)});
