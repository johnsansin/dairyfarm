'use client';
import SearchSelect from './search-select';
import StaffTeam from './staff-team';
import DropdownSettings from './dropdown-settings';
const timezones=Array.from(new Set(['UTC','Asia/Karachi',...Intl.supportedValuesOf('timeZone')]));
import {useEffect,useState,useCallback} from 'react';
import {Plus,Users2,ShieldCheck,UserPlus,Settings2} from 'lucide-react';
import {api} from './api';
import {modules as appModules} from '../shared/modules';
type Row=Record<string,string|number|boolean|null>;
const isSystem=(r:Row)=>r.is_system===true||r.is_system==='t';
const PERM=['none','read','write'] as const;
const LEVEL:{[k:string]:[string,string]}={none:['None','کوئی نہیں'],read:['Read','صرف پڑھیں'],write:['Write','لکھ سکتے ہیں']};
const lab=(en:string,urdu:string,ur:boolean)=>ur?urdu:en;
const modules=[...appModules,{key:'settings',en:'Settings',ur:'ترتیبات',singular:'settings',description:'Farm configuration access.',fields:[]}];
const permissionModules=modules;
const defaultFarmSettings={timezone:'Asia/Karachi',language:'English + Urdu',briefingTime:'06:00',notificationChannel:'Dashboard',offlineMode:'Enabled',notes:'',smtpHost:'',smtpPort:'587',smtpSecurity:'STARTTLS',smtpUsername:'',smtpPassword:'',smtpFromName:'DairyMonitor',smtpFromEmail:'',smtpEnabled:'Disabled'};
export default function AppSettings({base,ur,readOnly,management}:{base:string;ur:boolean;readOnly:boolean;management?:React.ReactNode}){
 const [tab,setTab]=useState<'roles'|'team'|'farm'|'workspace'|'dropdowns'>('roles');
 return <div className="app-view">
  <div className="module-heading"><div><h2>{ur?'ترتیبات اور ٹیم':'Settings & team'}</h2><p>{ur?'کردار اور اجازتیں، فارم کے ارکان، اور فارم کی بنیادی ترجیحات یہاں سے سنبھالیں۔':'Manage roles, permissions, team members, and farm-level preferences from one place.'}</p></div></div>
  <div className="history-tabs accounting-tabs">
   <button className={tab==='roles'?'button small':'secondary-button'} onClick={()=>setTab('roles')}><ShieldCheck size={15}/>{ur?'کردار اور اجازتیں':'Roles & permissions'}</button>
   <button className={tab==='team'?'button small':'secondary-button'} onClick={()=>setTab('team')}><Users2 size={15}/>{ur?'ٹیم':'Team'}</button>
   <button className={tab==='farm'?'button small':'secondary-button'} onClick={()=>setTab('farm')}><Settings2 size={15}/>{ur?'فارم کی ترتیب':'Farm settings'}</button>
   <button className={tab==='dropdowns'?'button small':'secondary-button'} onClick={()=>setTab('dropdowns')}>Application dropdowns</button>
   {management&&<button className={tab==='workspace'?'button small':'secondary-button'} onClick={()=>setTab('workspace')}><Settings2 size={15}/>{ur?'ڈیری فارم':'Dairy Farm'}</button>}
  </div>
  {tab==='dropdowns'?<DropdownSettings base={base} readOnly={readOnly}/>:tab==='workspace'?management:tab==='roles'?<RolesView base={base} ur={ur} readOnly={readOnly}/>:tab==='team'?<TeamView base={base} ur={ur} readOnly={readOnly}/>:<FarmSettingsView base={base} ur={ur} readOnly={readOnly}/>} 
 </div>;
}
function RolesView({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [roles,setRoles]=useState<Row[]>([]);const [perms,setPerms]=useState<Record<string,Record<string,string>>>({});const [error,setError]=useState('');
 const [adding,setAdding]=useState(false);const [editingRole,setEditingRole]=useState<Row|null>(null);const [name,setName]=useState('');const [desc,setDesc]=useState('');const [draft,setDraft]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const d=await api(base+'/roles');setRoles(d.roles);const p:Record<string,Record<string,string>>={};for(const x of d.permissions){if(!p[x.role_id])p[x.role_id]={};p[x.role_id][x.module]=x.access;}setPerms(p);setError('')}catch(e){setError((e as Error).message)}},[base]);
 useEffect(()=>{void load()},[load]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);try{await api(editingRole?base+'/roles/'+editingRole.id:base+'/roles',{method:editingRole?'PUT':'POST',body:JSON.stringify({name,description:desc,permissions:permissionModules.map(m=>({module:m.key,access:draft[m.key]||'none'}))})});setAdding(false);setEditingRole(null);setName('');setDesc('');setDraft({});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(error&&!adding&&roles.length===0)return <div className="form-error" role="alert">{error}</div>;
 return <div className="settings-layout roles-layout">
  <section className="workspace-panel"><div className="record-toolbar"><h3>{ur?'کردار':'Roles'}</h3>{!readOnly&&<button className="button small" onClick={()=>setAdding(true)}><Plus size={15}/>{ur?'نیا کردار':'New role'}</button>}</div>
   {roles.length===0&&<p className="search-note">{ur?'ابھی کوئی کردار نہیں':'No custom roles yet.'}</p>}
   {roles.map(r=><div key={String(r.id)} className="settings-row"><strong>{r.name}</strong>{r.description&&<span>{r.description}</span>}{isSystem(r)&&<small>{ur?'سسٹم':'System'}</small>}{!readOnly&&<button className="row-action" onClick={()=>{setEditingRole(r);setName(String(r.name));setDesc(String(r.description||''));setDraft(perms[String(r.id)]||{});setAdding(true)}}>{ur?'ترمیم':'Edit'}</button>}</div>)}
   <p className="search-note">{ur?'نوٹ: OWNER کے تمام حقوق ہیں؛ VIEWER صرف پڑھ سکتا ہے۔':'Note: OWNER holds full rights; VIEWER is read-only.'}</p>
  </section>
<section className="workspace-panel"><h3>{lab('Permissions','اجازتیں',ur)}</h3>
    {roles.length===0?<p className="search-note">{lab('Create a role to see permissions.','اجازتیں دیکھنے کے لیے کردار بنائیں',ur)}</p>:<div className="records-table-wrap permissions-scroll" tabIndex={0} aria-label="Role permissions"><table className="records-table"><thead><tr><th>{lab('Role','کردار',ur)}</th>{modules.map(m=><th key={m.key} title={m.en}>{lab(m.en,m.ur,ur)}</th>)}</tr></thead><tbody>
    {roles.map(r=><tr key={String(r.id)}><td>{r.name}</td>{modules.map(m=>{const v=perms[String(r.id)]?.[m.key]||'none';const editable=!isSystem(r)&&!readOnly;return <td key={m.key}>{editable?<SearchSelect aria-label={String(r.name)+' '+m.en+' permission'} disabled={busy} value={v} onChange={async e=>{setBusy(true);const val=e.target.value;const newPerms={...(perms[String(r.id)]||{}),[m.key]:val};try{await api(base+'/roles/'+String(r.id),{method:'PUT',body:JSON.stringify({name:String(r.name),description:String(r.description||''),permissions:modules.map(x=>({module:x.key,access:x.key===m.key?val:(perms[String(r.id)]?.[x.key]||'none')}))})});setPerms(p=>({...p,[String(r.id)]:newPerms}))}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}>{PERM.map(p=><option key={p} value={p}>{lab(LEVEL[p][0],LEVEL[p][1],ur)}</option>)}</SearchSelect>:PERM.map(p=>p===v?lab(LEVEL[p][0],LEVEL[p][1],ur):'').join('')}</td>})}</tr>)}
   </tbody></table></div>}
   {error&&<div className="form-error" role="alert">{error}</div>}
  </section>
  {adding&&<div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true"><div className="modal-heading"><h2><ShieldCheck size={17}/> {ur?'نیا کردار':'New role'}</h2><button className="row-action" onClick={()=>setAdding(false)} aria-label="Close">✕</button></div><form onSubmit={create}><div className="fields-grid">
   <label className="form-field">{ur?'کردار کا نام':'Role name'} *<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80}/></label>
   <label className="form-field wide">{ur?'تفصیل':'Description'}<input value={desc} onChange={e=>setDesc(e.target.value)} maxLength={300}/></label>
   {modules.map(m=><label className="form-field" key={m.key}>{lab(m.en,m.ur,ur)}<SearchSelect value={draft[m.key]||'none'} onChange={e=>setDraft(p=>({...p,[m.key]:e.target.value}))}>{PERM.map(p=><option key={p} value={p}>{lab(LEVEL[p][0],LEVEL[p][1],ur)}</option>)}</SearchSelect></label>)}
  </div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setAdding(false)}>{ur?'منسوخ':'Cancel'}</button><button className="button" disabled={busy}>{busy?'…':ur?'محفوظ کریں':'Save'}</button></div></form></section></div>}
 </div>;
}
function TeamView({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [editing,setEditing]=useState<Row|null>(null);
 const [rows,setRows]=useState<Row[]>([]);const [staff,setStaff]=useState<Row[]>([]);const [staffId,setStaffId]=useState('');const [roles,setRoles]=useState<Row[]>([]);const [error,setError]=useState('');const [adding,setAdding]=useState(false);const [email,setEmail]=useState('');const [role,setRole]=useState('VIEWER');const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const [team,r,s]=await Promise.all([api(base+'/team'),api(base+'/roles'),api(base+'/team/staff')]);setRows(team);setStaff(s);setRoles(r.roles.filter((x:Row)=>!isSystem(x)));setError('')}catch(e){setError((e as Error).message)}},[base]);
 useEffect(()=>{void load()},[load]);
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);try{const roleId=role.startsWith('CUSTOM:')?role.slice(7):null;if(editing)await api(base+'/team/'+editing.id,{method:'PUT',body:JSON.stringify({role:roleId?'VIEWER':role,roleId})});else{if(!staffId)throw new Error('Select a staff member.');await api(base+'/team/staff/'+staffId,{method:'PUT',body:JSON.stringify({email,roleId})})}setEmail('');setStaffId('');setRole('VIEWER');setEditing(null);setAdding(false);await load();if(editing)window.location.reload()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(r:Row){if(!window.confirm(ur?'اس رکن کی فارم تک رسائی ختم کریں؟':`Remove ${r.name} from this farm?`))return;setBusy(true);try{await api(base+'/team/'+r.id,{method:'DELETE'});window.location.reload()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="settings-layout team-layout"><StaffTeam base={base} ur={ur} readOnly={readOnly}/><section className="workspace-panel"><div className="record-toolbar"><h3>{ur?'فارم کے ارکان':'Farm members'}</h3>{!readOnly&&<button className="button small" onClick={()=>{setEditing(null);setEmail('');setRole('VIEWER');setError('');setAdding(true)}}><UserPlus size={15}/>{ur?'صارف شامل کریں':'Add user'}</button>}</div>
  <div className="records-table-wrap"><table className="records-table"><thead><tr><th>{ur?'نام':'Name'}</th><th>{ur?'ای میل':'Email'}</th><th>{ur?'کردار':'Role'}</th><th>{ur?'حالت':'Status'}</th></tr></thead><tbody>
   {rows.map(r=><tr key={String(r.id)}><td>{r.name}</td><td>{r.email}</td><td>{String(r.role_name||'')?String(r.role_name):roleLabel(String(r.role),ur)}</td><td>{String(r.status||'')}{!readOnly&&<div className="record-actions"><button className="secondary-button" disabled={busy} onClick={()=>{setEditing(r);setEmail(String(r.email));setRole(r.role_id?'CUSTOM:'+r.role_id:String(r.role));setError('');setAdding(true)}}>{ur?'ترمیم':'Edit'}</button><button className="secondary-button" disabled={busy} onClick={()=>remove(r)}>{ur?'ہٹائیں':'Remove'}</button></div>}</td></tr>)}
  </tbody></table></div>
  {error&&<div className="form-error" role="alert">{error}</div>}
 </section>
  {adding&&<div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true"><div className="modal-heading"><h2><UserPlus size={17}/> {editing?(ur?'رکن میں ترمیم':'Edit member'):(ur?'صارف شامل کریں':'Add user to farm')}</h2><button className="row-action" onClick={()=>setAdding(false)} aria-label="Close">✕</button></div><form onSubmit={add}><div className="fields-grid">
   {!editing&&<label className="form-field wide">{ur?'عملہ':'Staff member'} *<SearchSelect value={staffId} onChange={e=>{const id=e.target.value;setStaffId(id);const s=staff.find(x=>String(x.id)===id);setEmail(String(s?.email||s?.account_email||''))}} required><option value="">{ur?'عملہ منتخب کریں':'Select staff'}</option>{staff.map(s=><option key={String(s.id)} value={String(s.id)}>{s.name}{s.position?` · ${s.position}`:''}</option>)}</SearchSelect></label>}
   {!editing&&<label className="form-field wide">{ur?'عملہ کا ای میل':'Staff email'} *<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder={ur?'اگر موجود نہیں تو ای میل شامل کریں':'Add the staff email if it is missing'}/></label>}
   <label className="form-field">{ur?'کردار':'Role'} *<SearchSelect value={role} onChange={e=>setRole(e.target.value)}>
    <option value="OWNER">{ur?'مالک (OWNER)':'Owner'}</option><option value="VIEWER">{ur?'صرف دیکھنے والا (VIEWER)':'Viewer'}</option>
    {roles.map(rr=><option key={String(rr.id)} value={'CUSTOM:'+String(rr.id)}>{ur?'· ':''}{String(rr.name)} {ur?'(کردار)':'(role)'}</option>)}
   </SearchSelect></label>
  </div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setAdding(false)}>{ur?'منسوخ':'Cancel'}</button><button className="button" disabled={busy}>{busy?'…':editing?(ur?'محفوظ کریں':'Save member'):(ur?'شامل کریں':'Add member')}</button></div></form></section></div>}
 </div>;
}
function FarmSettingsView({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [values,setValues]=useState(defaultFarmSettings);const [testRecipient,setTestRecipient]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [ok,setOk]=useState('');
 const load=useCallback(async()=>{try{const data=await api(base+'/settings');setValues({...defaultFarmSettings,...data});setError('')}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[base]);
 useEffect(()=>{void load()},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setOk('');try{await api(base+'/settings',{method:'PUT',body:JSON.stringify(values)});setOk(ur?'فارم کی ترتیبات محفوظ ہو گئیں۔':'Farm settings saved.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function testEmail(){setBusy(true);setError('');setOk('');try{await api(base+'/settings/test-email',{method:'POST',body:JSON.stringify({recipient:testRecipient,settings:values})});setOk(ur?'SMTP کنکشن کامیاب ہے اور ٹیسٹ ای میل بھیج دی گئی۔':'SMTP configuration verified and test email sent.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(loading)return <div className="table-empty" role="status">{ur?'فارم کی ترتیبات لوڈ ہو رہی ہیں…':'Loading farm settings…'}</div>;
 return <form className="settings-layout" onSubmit={save}>
  <section className="workspace-panel">
   <div className="record-toolbar"><h3>{ur?'بنیادی ترجیحات':'Basic preferences'}</h3></div>
   <div className="fields-grid">
    <label className="form-field">{ur?'ٹائم زون':'Time zone'}<SearchSelect value={values.timezone} onChange={e=>setValues(v=>({...v,timezone:e.target.value}))} disabled={readOnly}>{timezones.map(t=><option key={t}>{t}</option>)}</SearchSelect></label>
    <label className="form-field">{ur?'ڈیفالٹ زبان':'Default language'}<SearchSelect value={values.language} onChange={e=>setValues(v=>({...v,language:e.target.value}))} disabled={readOnly}><option>English + Urdu</option><option>English</option><option>Urdu</option><option>Roman Urdu</option></SearchSelect></label>
    <label className="form-field">{ur?'روزانہ بریفنگ':'Daily briefing time'}<input value={values.briefingTime} onChange={e=>setValues(v=>({...v,briefingTime:e.target.value}))} placeholder="06:00" disabled={readOnly}/></label>
    <label className="form-field">{ur?'اطلاعات کا ذریعہ':'Notification channel'}<SearchSelect value={values.notificationChannel} onChange={e=>setValues(v=>({...v,notificationChannel:e.target.value}))} disabled={readOnly}><option>Dashboard</option><option>WhatsApp</option><option>SMS</option><option>Email</option></SearchSelect></label>
    <label className="form-field wide">{ur?'آف لائن موڈ':'Offline mode'}<SearchSelect value={values.offlineMode} onChange={e=>setValues(v=>({...v,offlineMode:e.target.value}))} disabled={readOnly}><option>Enabled</option><option>Limited</option><option>Disabled</option></SearchSelect></label>
    <label className="form-field wide">{ur?'نوٹس':'Notes'}<textarea rows={4} value={values.notes} onChange={e=>setValues(v=>({...v,notes:e.target.value}))} disabled={readOnly} placeholder={ur?'مثلاً صبح 5 بجے بریفنگ، شام 7 بجے دودھ کا خلاصہ':'e.g. Morning briefing at 5am, evening milk summary at 7pm'}/></label>
   </div>
   <p className="search-note">{ur?'یہ ترتیبات ہر فارم کے اندر محفوظ ہوتی ہیں اور بعد میں WhatsApp، PWA، اور آٹومیشن میں استعمال ہو سکتی ہیں۔':'These settings are saved per farm and can later drive WhatsApp, PWA, and automation behavior.'}</p>
   {error&&<div className="form-error" role="alert">{error}</div>}
   {ok&&<div className="form-success" role="status">{ok}</div>}
   {!readOnly&&<div className="modal-footer"><button className="button" disabled={busy}>{busy?(ur?'محفوظ ہو رہا ہے…':'Saving…'):(ur?'ترتیبات محفوظ کریں':'Save settings')}</button></div>}
  </section>
  <section className="workspace-panel smtp-panel">
   <div className="record-toolbar"><h3>{ur?'ای میل (SMTP)':'Email delivery (SMTP)'}</h3></div>
   <div className="fields-grid">
    <label className="form-field">{ur?'حالت':'Status'}<SearchSelect value={values.smtpEnabled} onChange={e=>setValues(v=>({...v,smtpEnabled:e.target.value}))} disabled={readOnly}><option>Disabled</option><option>Enabled</option></SearchSelect></label>
    <label className="form-field">{ur?'سیکیورٹی':'Security'}<SearchSelect value={values.smtpSecurity} onChange={e=>setValues(v=>({...v,smtpSecurity:e.target.value}))} disabled={readOnly}><option>STARTTLS</option><option>TLS</option><option>None</option></SearchSelect></label>
    <label className="form-field">{ur?'SMTP ہوسٹ':'SMTP host'}<input value={values.smtpHost} onChange={e=>setValues(v=>({...v,smtpHost:e.target.value}))} disabled={readOnly} placeholder="smtp.example.com"/></label>
    <label className="form-field">{ur?'پورٹ':'Port'}<input type="number" min="1" max="65535" value={values.smtpPort} onChange={e=>setValues(v=>({...v,smtpPort:e.target.value}))} disabled={readOnly}/></label>
    <label className="form-field">{ur?'صارف نام':'Username'}<input value={values.smtpUsername} onChange={e=>setValues(v=>({...v,smtpUsername:e.target.value}))} disabled={readOnly}/></label>
    <label className="form-field">{ur?'پاس ورڈ':'Password'}<input type="password" value={values.smtpPassword} onChange={e=>setValues(v=>({...v,smtpPassword:e.target.value}))} disabled={readOnly} autoComplete="new-password"/></label>
    <label className="form-field">{ur?'بھیجنے والے کا نام':'From name'}<input value={values.smtpFromName} onChange={e=>setValues(v=>({...v,smtpFromName:e.target.value}))} disabled={readOnly}/></label>
    <label className="form-field">{ur?'بھیجنے والا ای میل':'From email'}<input type="email" value={values.smtpFromEmail} onChange={e=>setValues(v=>({...v,smtpFromEmail:e.target.value}))} disabled={readOnly}/></label>
    <label className="form-field wide">{ur?'ٹیسٹ ای میل وصول کنندہ':'Test email recipient'}<input type="email" value={testRecipient} onChange={e=>setTestRecipient(e.target.value)} disabled={readOnly} placeholder="you@example.com"/></label>
   </div>
   {!readOnly&&<div className="smtp-actions"><button type="button" className="secondary-button" disabled={busy||!testRecipient||!values.smtpHost||!values.smtpFromEmail} onClick={()=>void testEmail()}>{ur?'کنفیگریشن ٹیسٹ کریں اور ای میل بھیجیں':'Test configuration & send email'}</button></div>}
  </section>
 </form>;
}
function roleLabel(r:string,ur:boolean){return r==='OWNER'?(ur?'مالک':'Owner'):(ur?'صرف دیکھنے والا':'Viewer')}
