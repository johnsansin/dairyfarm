import type {Pool} from 'pg';
export function normalizeWhatsApp(value:string){
 let phone=value.trim().replace(/[\s()-]/g,'');
 if(/^03\d{9}$/.test(phone))phone='+92'+phone.slice(1);
 else if(phone.startsWith('00'))phone='+'+phone.slice(2);
 else if(/^[1-9]\d{7,14}$/.test(phone))phone='+'+phone;
 return phone;
}
type Sale={farm_name:string;receipt_number:string;customer_name:string;created_at:string|Date;currency:string;subtotal:string;discount_type:string;discount_value:string;discount_amount:string;total:string;payment_method:string;amount_received:string;change_due:string;items:{name:string;quantity:string;unit:string;unit_price:string;total:string}[]};
export function receiptMessage(sale:Sale){
 const cash=(v:string)=>sale.currency+' '+Number(v).toFixed(2);
 return [sale.farm_name,'SALES RECEIPT',sale.receipt_number,new Date(sale.created_at).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})+' PKT','Customer: '+sale.customer_name,'',...sale.items.map(i=>`${i.name}: ${Number(i.quantity)} ${i.unit} × ${cash(i.unit_price)} = ${cash(i.total)}`),'','Subtotal: '+cash(sale.subtotal),`Discount${sale.discount_type==='percent'?' ('+Number(sale.discount_value)+'%)':''}: -${cash(sale.discount_amount)}`,'Total paid: '+cash(sale.total),'Payment: '+sale.payment_method,'Received: '+cash(sale.amount_received),'Change: '+cash(sale.change_due),'',`Thank you for shopping with ${sale.farm_name}! We look forward to serving you again.`].join('\n');
}
export type ReceiptTransport={readyToSend(farm:string):Promise<boolean>;sendReceipt(farm:string,phone:string,text:string):Promise<string>};
// Persist the intent in the sale transaction. Never repeat a send with an uncertain outcome.
export class ReceiptDispatcher {
 private timer?:NodeJS.Timeout;private running?:Promise<void>;private stopped=false;
 constructor(private pool:Pool,private transport:ReceiptTransport){}
 start(){this.timer=setInterval(()=>{void this.drain().catch(()=>{})},5000);this.timer.unref();void this.drain().catch(()=>{})}
 drain(){if(this.stopped)return Promise.resolve();if(this.running)return this.running;this.running=this.process().finally(()=>{this.running=undefined});return this.running}
 private async process(){
  await this.pool.query("UPDATE pos_receipt_messages SET status='unknown',last_error='Sending was interrupted. Check the customer chat before sending another receipt.',updated_at=now() WHERE status='sending' AND updated_at<now()-interval '5 minutes'");
  const farms=(await this.pool.query("SELECT DISTINCT farm_id FROM pos_receipt_messages WHERE status='pending'")).rows;
  for(const farm of farms){
   if(this.stopped)return;
   if(!await this.transport.readyToSend(farm.farm_id))continue;
   const rows=(await this.pool.query("SELECT farm_id,sale_id FROM pos_receipt_messages WHERE farm_id=$1 AND status='pending' ORDER BY created_at LIMIT 20",[farm.farm_id])).rows;
   for(const row of rows){
   if(this.stopped)return;
   if(!await this.transport.readyToSend(row.farm_id))continue;
   const message=(await this.pool.query("UPDATE pos_receipt_messages SET status='sending',updated_at=now() WHERE farm_id=$1 AND sale_id=$2 AND status='pending' RETURNING *",[row.farm_id,row.sale_id])).rows[0];
   if(!message)continue;
   let id:string;
   try{let timer:NodeJS.Timeout|undefined;try{id=await Promise.race([this.transport.sendReceipt(message.farm_id,message.recipient,message.body),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Send timeout')),60000)})])}finally{clearTimeout(timer)}}catch(error){
    const unavailable=error instanceof Error&&error.message==='Recipient is not on WhatsApp';
    await this.pool.query("UPDATE pos_receipt_messages SET status=$3,last_error=$4,updated_at=now() WHERE farm_id=$1 AND sale_id=$2",[row.farm_id,row.sale_id,unavailable?'failed':'unknown',unavailable?'This number is not registered on WhatsApp.':'Receipt sending could not be confirmed. Check the customer chat; the sale is saved.']);continue;
   }
   await this.pool.query("UPDATE pos_receipt_messages SET status='sent',message_id=$3,last_error=NULL,updated_at=now() WHERE farm_id=$1 AND sale_id=$2",[row.farm_id,row.sale_id,id]);
   }
  }
 }
 async stop(){this.stopped=true;clearInterval(this.timer);await this.running}
}
