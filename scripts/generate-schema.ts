import {writeFileSync} from 'node:fs';
import {modules} from '../shared/modules';
let sql=`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id uuid;\nALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;\nALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;\n`;
for(const m of modules){
 const cols=m.fields.map(f=>{
 let type=f.type==='date'?'date':f.type==='animal'||f.type==='buyer'||f.type==='staff'?'uuid':f.type==='number'?`numeric(18,${f.scale??2})`:'text';
 let clause=`${f.key} ${type}${f.required?' NOT NULL':''}`;
 if(f.type==='number')clause+=` CHECK (${f.key} >= ${f.min??0}${f.max!==undefined?` AND ${f.key} <= ${f.max}`:''})`;
 if(f.type==='select')clause+=` CHECK (${f.key} IN (${f.options!.map(v=>"'"+v.replaceAll("'","''")+"'").join(',')}))`;
 return clause;
 });
 if(m.fields.some(f=>f.type==='animal'))cols.push(`FOREIGN KEY (farm_id,animal_id) REFERENCES animals(farm_id,id)`);
if(m.fields.some(f=>f.type==='staff'))cols.push(`FOREIGN KEY (farm_id,assignee) REFERENCES staff(farm_id,id)`);
 if(m.key==='animals')cols.push('UNIQUE(farm_id,tag)');
 if(m.key==='milk')cols.push('UNIQUE(farm_id,animal_id,date,session)');
 sql+=`CREATE TABLE IF NOT EXISTS ${m.key} (id uuid PRIMARY KEY, farm_id uuid NOT NULL REFERENCES farms(id), created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1, ${cols.join(', ')}, UNIQUE(farm_id,id));\nCREATE INDEX IF NOT EXISTS ${m.key}_farm_created_idx ON ${m.key}(farm_id,created_at DESC);\n`;
}
sql+=`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock_quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK(stock_quantity>=0);\nALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock_value numeric(18,6) NOT NULL DEFAULT 0 CHECK(stock_value>=0);\n`;
writeFileSync('database/002_operations.sql',sql);
