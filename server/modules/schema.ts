import {z} from 'zod';
import {type Module} from '../../shared/modules';
export function schemaFor(module:Module){
 const shape:Record<string,z.ZodType>={};
 for(const f of module.fields){
  let schema:z.ZodType;
  if(f.type==='number')schema=z.union([z.number(),z.string()]).transform(String).refine(v=>/^\d+(\.\d+)?$/.test(v)&&Number(v)>=(f.min??0)&&Number(v)<=(f.max??999999999999)&&(!v.includes('.')||v.split('.')[1].length<=(f.scale??2)),`${f.en}: enter a valid non-negative number with at most ${f.scale??2} decimal places`);
  else if(f.type==='date')schema=z.iso.date();
  else if(f.type==='animal'||f.type==='buyer'||f.type==='staff')schema=z.uuid();
  else if(f.type==='select')schema=z.enum(f.options as [string,...string[]]);
  else schema=z.string().trim().min(f.required?1:0).max(f.type==='textarea'?4000:200);
  shape[f.key]=f.required?schema:z.preprocess(v=>v===''||v===undefined?null:v,schema.nullable());
 }
 return z.object(shape).strict();
}
