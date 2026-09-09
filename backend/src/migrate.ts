import {readFile,readdir} from 'node:fs/promises';
import {db} from './db';
export async function migrate(){
 if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL before migrating');
 const client=await db.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(843928)');await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const file of (await readdir('database')).filter(f=>f.endsWith('.sql')).sort()){
   if((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[file])).rowCount)continue;
   await client.query(await readFile(`database/${file}`,'utf8'));await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[file]);console.log(`Applied ${file}`);
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await db.end();}
}
if(process.argv[1]&&/\bmigrate\.(ts|js)$/.test(process.argv[1])){
 migrate().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
}
