import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';

export async function addNotification(client:Pool|PoolClient,type:'farm.created'|'user.created',targetId:string,targetName:string,detail:Record<string,unknown>={}){
 await client.query('INSERT INTO platform_notifications(id,type,target_id,target_name,detail) VALUES($1,$2,$3,$4,$5)',[randomUUID(),type,targetId,targetName,JSON.stringify(detail)]);
}