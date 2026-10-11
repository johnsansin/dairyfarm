import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {db} from '../db';
import {DomainError} from './operations';
import {WhatsAppService} from './whatsapp-service';
export const whatsapp=new WhatsAppService(db);
export const whatsappRouter=Router({mergeParams:true});
whatsappRouter.use((_req,res,next)=>{if(res.locals.farm.role!=='OWNER')throw new DomainError(403,'Only the farm owner can manage the WhatsApp connection');next()});
whatsappRouter.get('/',async(_req,res)=>{res.json(await whatsapp.status(res.locals.farm.id))});
whatsappRouter.post('/connect',async(_req,res)=>{
 const farm=res.locals.farm.id;
 const status=await whatsapp.connect(farm,res.locals.user.id);
 await db.query('INSERT INTO audit_logs(id,farm_id,user_id,action) VALUES($1,$2,$3,$4)',[randomUUID(),farm,res.locals.user.id,'whatsapp.connect.requested']);
 res.status(202).json(status);
});
whatsappRouter.post('/disconnect',async(_req,res)=>{
 const farm=res.locals.farm.id;
 const status=await whatsapp.disconnect(farm);
 await db.query('INSERT INTO audit_logs(id,farm_id,user_id,action) VALUES($1,$2,$3,$4)',[randomUUID(),farm,res.locals.user.id,'whatsapp.disconnected']);
 res.json(status);
});
