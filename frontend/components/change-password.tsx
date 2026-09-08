'use client';
import {useState} from 'react';
import {KeyRound,X,CheckCircle2} from 'lucide-react';
export default function ChangePassword({ur,onClose}:{ur:boolean;onClose:()=>void}){
 const [current,setCurrent]=useState('');const [next,setNext]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [ok,setOk]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setOk('');if(next.length<6){setError(ur?'نیا پاس ورڈ کم از کم ۶ حروف کا ہو:'+'انگریزی':'New password must be at least 6 characters.');return}if(next!==confirm){setError(ur?'پاس ورڈ مماثل نہیں':'Passwords do not match.');return}setBusy(true);try{
  const r=await fetch('/api/v1/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:current,new_password:next})});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error);
  setOk(ur?'پاس ورڈ تبدیل ہو گیا۔ براہ کرم دوبارہ سائن ان کریں۔':'Password changed. Please sign in again.');
  setCurrent('');setNext('');setConfirm('');
  setTimeout(()=>{window.location.href='/signin'},1500);
 }catch(e){setError(e instanceof Error?e.message:(ur?'پاس ورڈ تبدیل نہیں ہوا':'Could not change password.'))}finally{setBusy(false)}}
 return <div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true">
  <div className="modal-heading"><h2><KeyRound size={18}/> {ur?'پروفائل اور پاس ورڈ':'Profile & password'}</h2><button className="row-action" onClick={onClose} aria-label="Close"><X/></button></div>
  <form onSubmit={submit}><div className="fields-grid">
   <label className="form-field wide">{ur?'موجودہ پاس ورڈ':'Current password'}<input type="password" value={current} onChange={e=>setCurrent(e.target.value)} required minLength={1} autoComplete="current-password"/></label>
   <label className="form-field">{ur?'نیا پاس ورڈ':'New password'}<input type="password" value={next} onChange={e=>setNext(e.target.value)} required minLength={6} maxLength={72} autoComplete="new-password"/></label>
   <label className="form-field">{ur?'نئے پاس ورڈ کی تصدیق':'Confirm new password'}<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={6} autoComplete="new-password"/></label>
  </div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  {ok&&<div className="form-success" role="status"><CheckCircle2 size={16}/>{ok}</div>}
  <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>{ur?'منسوخ':'Cancel'}</button><button className="button" disabled={busy}>{busy?(ur?'محفوظ ہو رہا ہے…':'Saving…'):(ur?'پاس ورڈ تبدیل کریں':'Change password')}</button></div>
 </form></section></div>;
}