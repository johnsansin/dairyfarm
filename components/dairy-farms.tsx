'use client';
import SearchSelect from './search-select';
import {useState} from 'react';
import {Building2,Plus,MapPin,Pencil} from 'lucide-react';
import {api} from './api';
export interface FarmProfile{id:string;name:string;city:string;currency:string;role:string;version?:number;address?:string;email?:string;phone?:string;country?:string;postal_code?:string;contact_name?:string;organization_id?:string|null}
const fields=[
 ['name','Farm name','ڈیری فارم کا نام',100],['city','City / location','شہر / مقام',100],
 ['address','Address','مکمل پتہ',500],['country','Country','ملک',100],
 ['postal_code','Postal code','پوسٹل کوڈ',20],['email','Email','ای میل',254],
 ['phone','Phone','فون',40],['contact_name','Contact person','رابطہ شخص',100]
] as const;
export default function DairyFarms({farms,selected,ur,onSaved,onSelect}:{farms:FarmProfile[];selected:string;ur:boolean;onSaved:(farm:FarmProfile)=>void;onSelect:(id:string)=>void}){
 const [editing,setEditing]=useState<FarmProfile|null>(null);
 const [adding,setAdding]=useState(false);const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const t=(en:string,ud:string)=>ur?ud:en;
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setSuccess('');
  const payload=Object.fromEntries(new FormData(e.currentTarget));
  try{
   const row=await api('/api/v1/farms'+(editing?'/'+editing.id:''),{method:editing?'PUT':'POST',body:JSON.stringify({...payload,...(editing?{version:editing.version}: {})})});
   onSaved(row);setEditing(null);setAdding(false);setSuccess(t('Dairy farm details saved.','ڈیری فارم کی معلومات محفوظ ہو گئیں۔'));
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="dairy-farms">
  <div className="module-heading"><div><span className="eyebrow">{t('DAIRY FARM','ڈیری فارم')}</span><h2>{t('Dairy Farm','ڈیری فارم')}</h2><p>{t('View your existing dairy farms and manage their location and contact details.','اپنے موجودہ ڈیری فارم دیکھیں اور مقام اور رابطے کی معلومات سنبھالیں۔')}</p></div>
   {!adding&&!editing&&farms.length>0&&<button className="button small" onClick={()=>{setAdding(true);setError('');setSuccess('')}}><Plus size={16}/>{t('Add dairy farm','ڈیری فارم شامل کریں')}</button>}
  </div>
  {success&&<p className="form-success" role="status">{success}</p>}
  {!adding&&!editing&&farms.length>0&&<div className="dairy-farm-grid">{farms.map(f=><article className="workspace-panel dairy-farm-card" key={f.id}>
   <div className="record-toolbar"><Building2 size={22}/><span>{f.id===selected?t('Active farm','منتخب فارم'):t('Dairy farm','ڈیری فارم')}</span></div>
   <h3>{f.name}</h3><p><MapPin size={14}/> {f.city}{f.country?', '+f.country:''}</p>
   <dl className="detail-grid">{fields.map(([key,en,ud])=><div key={key}><dt>{t(en,ud)}</dt><dd>{f[key]||t('Not provided','درج نہیں')}</dd></div>)}<div><dt>{t('Base currency','بنیادی کرنسی')}</dt><dd>{f.currency}</dd></div></dl>
   <div className="record-actions">{f.role==='OWNER'&&<button className="secondary-button" onClick={()=>{setEditing(f);setError('');setSuccess('')}}><Pencil size={14}/>{t('Edit farm details','فارم کی معلومات میں ترمیم')}</button>}{f.id!==selected&&<button className="secondary-button" onClick={()=>onSelect(f.id)}>{t('Open farm','فارم کھولیں')}</button>}</div>
  </article>)}</div>}
  {(adding||editing||!farms.length)&&<form key={editing?.id||'new'} onSubmit={save} className="workspace-panel">
   <h3>{editing?t('Edit dairy farm','ڈیری فارم میں ترمیم'):t('Add dairy farm','ڈیری فارم شامل کریں')}</h3>
   <div className="fields-grid">{fields.map(([key,en,ud,max])=><label className={'form-field'+(key==='address'?' wide':'')} key={key}>{t(en,ud)}{key==='name'||key==='city'?' *':''}<input aria-label={t(en,ud)} name={key} type={key==='email'?'email':key==='phone'?'tel':'text'} defaultValue={editing?.[key]||''} required={key==='name'||key==='city'} minLength={key==='name'||key==='city'?2:undefined} maxLength={max}/></label>)}
   <label className="form-field">{t('Base currency','بنیادی کرنسی')}<SearchSelect name="currency" defaultValue={editing?.currency||'PKR'}>{['PKR','USD','GBP','EUR','AED','SAR'].map(c=><option key={c}>{c}</option>)}</SearchSelect></label></div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="modal-footer">{farms.length>0&&<button type="button" disabled={busy} className="secondary-button" onClick={()=>{setAdding(false);setEditing(null);setError('')}}>{t('Cancel','منسوخ کریں')}</button>}<button className="button" disabled={busy}>{busy?t('Saving…','محفوظ ہو رہا ہے…'):editing?t('Save farm details','معلومات محفوظ کریں'):t('Create farm','فارم بنائیں')}</button></div>
  </form>}
 </section>;
}
