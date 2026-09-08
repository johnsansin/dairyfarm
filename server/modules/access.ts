import {db} from '../db';
export async function accessFor(farm:string,user:string){
 const member=(await db.query("SELECT role,role_id FROM farm_members WHERE farm_id=$1 AND user_id=$2 AND status='Active'",[farm,user])).rows[0];
 if(!member)return null;
 const permissions:Record<string,string>={};
 if(member.role_id)for(const p of (await db.query('SELECT module,access FROM permissions WHERE farm_id=$1 AND role_id=$2',[farm,member.role_id])).rows)permissions[p.module]=p.access;
 return {...member,permissions};
}
export function canAccess(member:any,module:string,write=false){return member.role==='OWNER'||(!member.role_id?!write:write?member.permissions[module]==='write':['read','write'].includes(member.permissions[module]));}
