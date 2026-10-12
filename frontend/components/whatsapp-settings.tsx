'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {CheckCircle2,Link2,LoaderCircle,MessageCircle,RefreshCw,ShieldCheck,Smartphone,Unplug} from 'lucide-react';
import {api} from './api';

type Status={configured:boolean;status:'disconnected'|'connecting'|'qr'|'connected'|'reconnecting'|'error';phone_number:string|null;account_name:string|null;last_error:string|null;linked_at:string|null;qr_data_url:string|null;qr_expires_at:string|null;remote_logout?:boolean};
const labels={disconnected:['Not linked','منسلک نہیں'],connecting:['Connecting','رابطہ ہو رہا ہے'],qr:['Scan QR code','کیو آر کوڈ اسکین کریں'],connected:['Connected','منسلک ہے'],reconnecting:['Reconnecting','دوبارہ رابطہ ہو رہا ہے'],error:['Connection needs attention','رابطہ دوبارہ قائم کریں']};
export default function WhatsAppSettings({base,ur,isOwner}:{base:string;ur:boolean;isOwner:boolean}){
 const [status,setStatus]=useState<Status|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 const active=useRef(true),inFlight=useRef(false),requestVersion=useRef(0);
 const text=(en:string,urdu:string)=>ur?urdu:en;
 const refresh=useCallback(async()=>{
  const version=requestVersion.current;
  try{const next=await api(base+'/settings/whatsapp');if(active.current&&version===requestVersion.current){setStatus(next);setError('')}}catch(e){if(active.current&&version===requestVersion.current)setError((e as Error).message)}finally{if(active.current)setLoading(false)}
 },[base]);
 useEffect(()=>{
  active.current=true;if(!isOwner){setLoading(false);return}
  void refresh();const poll=setInterval(()=>{if(!document.hidden&&!inFlight.current)void refresh()},3000),clock=setInterval(()=>setNow(Date.now()),1000);
  return()=>{active.current=false;clearInterval(poll);clearInterval(clock);requestVersion.current++};
 },[refresh,isOwner]);
 async function act(action:'connect'|'disconnect'){
  if(inFlight.current)return;
  if(action==='disconnect'&&!window.confirm(text('Unlink WhatsApp from this farm? You will need to scan a new QR code to link it again.','اس فارم سے واٹس ایپ کا رابطہ ختم کریں؟ دوبارہ لنک کرنے کے لیے نیا کیو آر کوڈ اسکین کرنا ہوگا۔')))return;
  inFlight.current=true;requestVersion.current++;setBusy(true);setError('');setNotice('');
  try{const next=await api(base+'/settings/whatsapp/'+action,{method:'POST',body:'{}'});if(active.current){setStatus(next);if(action==='disconnect')setNotice(next.remote_logout?text('WhatsApp unlinked from this farm.','واٹس ایپ کا رابطہ ختم ہوگیا۔'):text('Saved connection removed. If DairyMonitor still appears in WhatsApp Linked devices, remove it there too.','محفوظ رابطہ ختم ہوگیا۔ اگر واٹس ایپ کے منسلک آلات میں ڈیری مانیٹر نظر آئے تو اسے وہاں سے بھی ہٹا دیں۔'))}}
  catch(e){if(active.current)setError((e as Error).message)}finally{inFlight.current=false;if(active.current)setBusy(false)}
 }
 if(!isOwner)return <section className="workspace-panel"><h3>{text('WhatsApp connection','واٹس ایپ رابطہ')}</h3><p>{text('Only the farm owner can link or unlink the farm’s WhatsApp number.','صرف فارم کا مالک اس فارم کا واٹس ایپ نمبر منسلک یا غیر منسلک کر سکتا ہے۔')}</p></section>;
 const current=status?.status||'disconnected',waiting=['connecting','reconnecting'].includes(current),seconds=status?.qr_expires_at?Math.max(0,Math.ceil((new Date(status.qr_expires_at).getTime()-now)/1000)):0,hasQR=current==='qr'&&!!status?.qr_data_url&&seconds>0;
 return <div className="whatsapp-settings">
  <section className="workspace-panel whatsapp-connection"><div className="whatsapp-title"><span className="whatsapp-brand"><MessageCircle size={27}/></span><div><h3>{text('Your farm’s WhatsApp','آپ کے فارم کا واٹس ایپ')}</h3><p>{text('Link your own number to this farm. Each farm has its own connection.','اس فارم کے ساتھ اپنا نمبر منسلک کریں۔ ہر فارم کا رابطہ الگ ہے۔')}</p></div></div>
   {error&&<div className="form-error" role="alert">{error}</div>}{notice&&<div className="form-success" role="status">{notice}</div>}
   {loading?<p role="status">{text('Loading connection…','رابطہ لوڈ ہو رہا ہے…')}</p>:<>
    <div className={'whatsapp-status '+current} role="status">{current==='connected'?<CheckCircle2 size={18}/>:waiting?<LoaderCircle size={18} className="whatsapp-spinner"/>:<span className="whatsapp-status-dot"/>}<strong>{labels[current]?.[ur?1:0]||current}</strong></div>
    {!status?.configured?<p className="form-error">{text('WhatsApp linking is not available on this server yet. Contact the platform administrator.','اس سرور پر واٹس ایپ کا رابطہ ابھی دستیاب نہیں ہے۔ منتظم سے رابطہ کریں۔')}</p>:<>
     {current==='connected'?<div className="whatsapp-account"><Smartphone size={28}/><div><strong dir="ltr">{status.phone_number||text('WhatsApp account linked','واٹس ایپ اکاؤنٹ منسلک ہے')}</strong>{status.account_name&&<span>{status.account_name}</span>}{status.linked_at&&<small>{text('Connected since ','منسلک ہونے کا وقت ')}{new Date(status.linked_at).toLocaleString()}</small>}</div></div>:<div className="whatsapp-pairing">
      {hasQR?<><div className="whatsapp-qr"><img src={status.qr_data_url!} width={280} height={280} alt={text('Scan this QR code with WhatsApp to link this farm','اس فارم کو منسلک کرنے کے لیے واٹس ایپ سے یہ کیو آر کوڈ اسکین کریں')}/></div><p className="whatsapp-expiry">{text('QR refreshes automatically. Valid for ','کیو آر کوڈ خود بخود تبدیل ہوگا۔ باقی وقت ')}{seconds}{text(' seconds.',' سیکنڈ۔')}</p></>:waiting||current==='qr'?<div className="whatsapp-qr-placeholder"><LoaderCircle size={32} className="whatsapp-spinner"/><p>{text(current==='qr'?'Waiting for a fresh QR code…':'Preparing your secure connection…',current==='qr'?'نئے کیو آر کوڈ کا انتظار ہے…':'رابطہ تیار ہو رہا ہے…')}</p></div>:<div className="whatsapp-qr-placeholder"><Smartphone size={42}/><h4>{text('Connect with a QR code','کیو آر کوڈ کے ذریعے رابطہ کریں')}</h4><p>{text('Keep the phone with your WhatsApp number nearby.','اپنے واٹس ایپ نمبر والا فون پاس رکھیں۔')}</p></div>}
     </div>}
     {status.last_error&&<div className="form-error" role="alert">{status.last_error}</div>}
     <div className="whatsapp-actions">{!['connected','qr','connecting','reconnecting'].includes(current)&&<button className="button" disabled={busy} onClick={()=>void act('connect')}><Link2 size={17}/>{busy?text('Connecting…','رابطہ ہو رہا ہے…'):text('Link WhatsApp','واٹس ایپ منسلک کریں')}</button>}{current!=='disconnected'&&<button className="secondary-button" disabled={busy} onClick={()=>void act('disconnect')}><Unplug size={16}/>{text(current==='connected'?'Unlink WhatsApp':'Cancel / reset connection',current==='connected'?'واٹس ایپ کا رابطہ ختم کریں':'رابطہ منسوخ / ری سیٹ کریں')}</button>}<button className="secondary-button" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/>{text('Refresh status','حالت تازہ کریں')}</button></div>
    </>}
   </>}
  </section>
  <aside className="workspace-panel whatsapp-guide"><span className="whatsapp-guide-icon"><Smartphone size={24}/></span><h3>{text('Link your number','اپنا نمبر منسلک کریں')}</h3><ol><li>{text('Click Link WhatsApp to display a QR code.','کیو آر کوڈ دیکھنے کے لیے واٹس ایپ منسلک کریں پر کلک کریں۔')}</li><li>{text('Open WhatsApp on your phone.','اپنے فون پر واٹس ایپ کھولیں۔')}</li><li>{text('Go to Settings (iPhone) or the ⋮ menu (Android) → Linked devices → Link a device.','سیٹنگز (آئی فون) یا ⋮ مینو (اینڈرائیڈ) → منسلک آلات → ایک آلہ منسلک کریں پر جائیں۔')}</li><li>{text('Scan the QR code shown here. Your number will appear when connected.','یہاں دکھایا گیا کیو آر کوڈ اسکین کریں۔ رابطہ ہونے پر آپ کا نمبر نظر آئے گا۔')}</li></ol><div className="whatsapp-private"><ShieldCheck size={19}/><p>{text('Only this farm’s owner can manage this connection. Session credentials are encrypted and kept separate from other farms.','صرف اس فارم کا مالک یہ رابطہ سنبھال سکتا ہے۔ رابطے کی اسناد محفوظ اور دوسرے فارموں سے الگ رکھی جاتی ہیں۔')}</p></div><p className="whatsapp-note">{text('Linking alone does not send messages or turn on automatic replies. You can remove this connection here or from Linked devices on your phone.','صرف رابطہ قائم کرنے سے پیغامات یا خودکار جوابات شروع نہیں ہوتے۔ آپ یہاں یا اپنے فون کے منسلک آلات سے رابطہ ختم کر سکتے ہیں۔')}</p><small>{text('Connection powered by Baileys.','رابطہ بائلیز کے ذریعے۔')}</small></aside>
 </div>;
}
