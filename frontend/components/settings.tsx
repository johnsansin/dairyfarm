'use client';
import SearchSelect from './search-select-v2';
import StaffTeam from './staff-team';
import DropdownSettings from './dropdown-settings';
const timezones=Array.from(new Set(['UTC','Asia/Karachi',...Intl.supportedValuesOf('timeZone')]));
import {useEffect,useState,useCallback} from 'react';
import {Plus,Users2,ShieldCheck,UserPlus,Settings2,Search,ChevronRight,ArrowLeft,ListChecks,Building2,Save,CheckCircle2,Mail,Pencil,X,PlugZap,Send} from 'lucide-react';
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
 type SettingsTab='roles'|'team'|'farm'|'workspace'|'dropdowns';
 const [tab,setTab]=useState<SettingsTab|null>(null);const [search,setSearch]=useState('');
 const sections:[SettingsTab,typeof ShieldCheck,string,string][]=[
  ['team',Users2,ur?'صارفین':'Users',ur?'فارم کے صارفین، عملے کے اکاؤنٹس اور تفویض کردہ کردار سنبھالیں۔':'Manage farm users, staff accounts, assigned roles, and access status.'],
  ['roles',ShieldCheck,ur?'کردار اور اجازتیں':'Roles & permissions',ur?'فارم کے ہر حصے کے لیے حسب ضرورت کردار اور رسائی متعین کریں۔':'Create reusable roles and control read or write access for every farm module.'],
  ['farm',Settings2,ur?'فارم کی ترجیحات':'Farm preferences',ur?'زبان، ٹائم زون، اطلاعات اور ای میل کی ترسیل ترتیب دیں۔':'Configure language, time zone, notifications, and email delivery.'],
  ['dropdowns',ListChecks,ur?'ایپ ڈراپ ڈاؤنز':'Application dropdowns',ur?'ریکارڈ فارم میں استعمال ہونے والے اضافی اختیارات سنبھالیں۔':'Manage additional choices used throughout record forms.'],
  ...(management?[['workspace',Building2,ur?'ڈیری فارم':'Dairy farm',ur?'فارم اور تنظیم کی بنیادی معلومات سنبھالیں۔':'Manage the farm and organization details.'] as [SettingsTab,typeof ShieldCheck,string,string]]:[])
 ];
 const filtered=sections.filter(([, ,title,description])=>(title+' '+description).toLowerCase().includes(search.toLowerCase()));
 if(!tab)return <div className="app-view settings-control-center">
  <section className="settings-hero"><span className="settings-eyebrow"><Settings2 size={14}/>{ur?'کنٹرول سینٹر':'Control center'}</span><h2>{ur?'ترتیبات':'Settings'}</h2><p>{ur?'صارفین، اجازتیں، فارم کی ترجیحات اور ایپ کی ترتیب ایک جگہ سے سنبھالیں۔':'Configure your workspace — users, permissions, farm preferences, and application choices.'}</p></section>
  <label className="settings-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={ur?'ترتیبات تلاش کریں…':'Search settings…'} aria-label={ur?'ترتیبات تلاش کریں':'Search settings'}/></label>
  <section className="settings-category"><div><h3>{ur?'صارفین اور فارم کی ترتیب':'Users & farm access'}</h3><p>{ur?'لوگ، کردار، رسائی اور ورک اسپیس کی ترجیحات':'People, roles, access, and workspace preferences'}</p></div>
   <div className="settings-card-grid">{filtered.map(([key,Icon,title,description])=><button type="button" aria-label={key==='team'?'Team':title} className={`settings-card settings-card-${key}`} key={key} onClick={()=>setTab(key)}><span className="settings-card-icon"><Icon size={21}/></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}</div>
   {!filtered.length&&<p className="table-empty">{ur?'کوئی ترتیب نہیں ملی۔':'No settings match your search.'}</p>}
  </section>
 </div>;
 const current=sections.find(([key])=>key===tab)!;const CurrentIcon=current[1];
 return <div className="app-view">
  <button type="button" className="settings-back" onClick={()=>setTab(null)}><span><ArrowLeft size={15}/></span><strong>{ur?'تمام ترتیبات':'All settings'}</strong><small>{ur?'کنٹرول سینٹر پر واپس':'Back to control center'}</small></button>
  <div className="settings-section-heading"><span className={`settings-card-icon settings-card-${tab}`}><CurrentIcon size={22}/></span><div><h2>{current[2]}</h2><p>{current[3]}</p></div></div>
  {tab==='dropdowns'?<DropdownSettings base={base} readOnly={readOnly}/>:tab==='workspace'?management:tab==='roles'?<RolesView base={base} ur={ur} readOnly={readOnly}/>:tab==='team'?<TeamView base={base} ur={ur} readOnly={readOnly}/>:<FarmSettingsView base={base} ur={ur} readOnly={readOnly}/>} 
 </div>;
}
function RolesView({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [roles,setRoles]=useState<Row[]>([]);const [perms,setPerms]=useState<Record<string,Record<string,string>>>({});const [selectedRoleId,setSelectedRoleId]=useState('');const [permDraft,setPermDraft]=useState<Record<string,string>>({});const [error,setError]=useState('');const [ok,setOk]=useState('');
 const [adding,setAdding]=useState(false);const [editingRole,setEditingRole]=useState<Row|null>(null);const [name,setName]=useState('');const [desc,setDesc]=useState('');const [roleDraft,setRoleDraft]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const d=await api(base+'/roles');setRoles(d.roles);const p:Record<string,Record<string,string>>={};for(const x of d.permissions){if(!p[x.role_id])p[x.role_id]={};p[x.role_id][x.module]=x.access;}setPerms(p);setSelectedRoleId(previous=>{const id=d.roles.some((r:Row)=>String(r.id)===previous)?previous:String(d.roles[0]?.id||'');setPermDraft({...p[id]});return id});setError('')}catch(e){setError((e as Error).message)}},[base]);
 useEffect(()=>{void load()},[load]);
 const selected=roles.find(r=>String(r.id)===selectedRoleId);const editable=!!selected&&!isSystem(selected)&&!readOnly;const enabled=modules.filter(m=>(permDraft[m.key]||'none')!=='none').length;const writable=modules.filter(m=>(permDraft[m.key]||'none')==='write').length;
 function selectRole(r:Row){const id=String(r.id);setSelectedRoleId(id);setPermDraft({...perms[id]});setError('');setOk('')}
 function setAll(access:string){if(editable)setPermDraft(Object.fromEntries(modules.map(m=>[m.key,access])))}
 async function savePermissions(){if(!selected||!editable)return;setBusy(true);setError('');setOk('');try{await api(base+'/roles/'+selectedRoleId,{method:'PUT',body:JSON.stringify({name:String(selected.name),description:String(selected.description||''),permissions:modules.map(m=>({module:m.key,access:permDraft[m.key]||'none'}))})});setPerms(p=>({...p,[selectedRoleId]:{...permDraft}}));setOk(ur?'اجازتیں محفوظ ہو گئیں۔':'Permissions saved.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await api(editingRole?base+'/roles/'+editingRole.id:base+'/roles',{method:editingRole?'PUT':'POST',body:JSON.stringify({name,description:desc,permissions:permissionModules.map(m=>({module:m.key,access:roleDraft[m.key]||'none'}))})});setAdding(false);setEditingRole(null);setName('');setDesc('');setRoleDraft({});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function openNew(){setEditingRole(null);setName('');setDesc('');setRoleDraft({});setError('');setAdding(true)}
 function openEdit(r:Row){setEditingRole(r);setName(String(r.name));setDesc(String(r.description||''));setRoleDraft({...perms[String(r.id)]});setError('');setAdding(true)}
 if(error&&!adding&&roles.length===0)return <div className="form-error" role="alert">{error}</div>;
 return <div className="crm-roles-layout">
  <section className="workspace-panel crm-role-list"><div className="record-toolbar"><div><h3>{ur?'کردار':'Roles'}</h3><p>{ur?'اجازتیں دیکھنے یا تبدیل کرنے کے لیے کردار منتخب کریں۔':'Select a role to view or configure its permissions.'}</p></div>{!readOnly&&<button className="button small" onClick={openNew}><Plus size={15}/>{ur?'نیا کردار':'New role'}</button>}</div>
   <div className="crm-role-items">{roles.map(r=><button type="button" key={String(r.id)} className={selectedRoleId===String(r.id)?'crm-role-item selected':'crm-role-item'} onClick={()=>selectRole(r)}><span className="role-shield"><ShieldCheck size={16}/></span><span><strong>{r.name}</strong><small>{r.description||lab('Farm access role','فارم رسائی کا کردار',ur)}</small></span>{isSystem(r)&&<em>{ur?'سسٹم':'System'}</em>}<ChevronRight size={15}/></button>)}</div>
   {!roles.length&&<p className="table-empty">{ur?'ابھی کوئی کردار نہیں۔':'No roles defined.'}</p>}
  </section>
  <section className="workspace-panel crm-permission-panel">{selected?<>
   <div className="crm-permission-head"><div><h3><ShieldCheck size={17}/>{lab('Module permissions','ماڈیول کی اجازتیں',ur)} <span>— {String(selected.name)}</span></h3><p>{lab('Choose an access level for each module. Changes apply when you save.','ہر ماڈیول کے لیے رسائی منتخب کریں۔ تبدیلیاں محفوظ کرنے پر لاگو ہوں گی۔',ur)}</p></div>{editable&&<button type="button" className="secondary-button" onClick={()=>openEdit(selected)}>{ur?'کردار میں ترمیم':'Edit role'}</button>}</div>
   <div className="permission-summary"><span><CheckCircle2 size={14}/><strong>{enabled}/{modules.length}</strong> {ur?'فعال':'enabled'}</span><span><strong>{writable}</strong> {ur?'تحریری رسائی':'write access'}</span>{editable&&<div><button type="button" onClick={()=>setAll('read')}>{ur?'سب پڑھیں':'Read all'}</button><button type="button" onClick={()=>setAll('write')}>{ur?'سب لکھیں':'Write all'}</button><button type="button" onClick={()=>setAll('none')}>{ur?'سب بند':'Disable all'}</button></div>}</div>
   <div className="crm-permissions-table"><table><thead><tr><th>{lab('Module','ماڈیول',ur)}</th>{PERM.map(p=><th key={p}>{lab(LEVEL[p][0],LEVEL[p][1],ur)}</th>)}</tr></thead><tbody>{modules.map((m,index)=>{const value=permDraft[m.key]||'none';return <tr key={m.key} className={index%2?'alternate':''}><td><strong>{lab(m.en,m.ur,ur)}</strong><small>{m.description}</small></td>{PERM.map(access=><td key={access}><button type="button" disabled={!editable||busy} aria-label={String(selected.name)+' '+m.en+' '+access} aria-pressed={value===access} className={'permission-choice '+access+(value===access?' active':'')} onClick={()=>setPermDraft(p=>({...p,[m.key]:access}))}><span/></button></td>)}</tr>})}</tbody></table></div>
   {error&&<div className="form-error" role="alert">{error}</div>}{ok&&<div className="form-success" role="status">{ok}</div>}
   {editable&&<div className="permission-savebar"><span>{ur?'غیر محفوظ تبدیلیاں محفوظ کرنے کے لیے کلک کریں۔':'Review your access levels, then apply them to this role.'}</span><button type="button" className="button small" disabled={busy} onClick={()=>void savePermissions()}><Save size={15}/>{busy?'…':ur?'اجازتیں محفوظ کریں':'Save permissions'}</button></div>}
   {!editable&&<p className="permission-system-note">{isSystem(selected)?lab('System roles are protected and cannot be edited.','سسٹم کردار محفوظ ہیں اور تبدیل نہیں کیے جا سکتے۔',ur):lab('You have read-only access to role settings.','آپ کو کردار کی ترتیبات تک صرف پڑھنے کی رسائی ہے۔',ur)}</p>}
  </>:<p className="table-empty">{lab('Select a role to edit permissions.','اجازتیں تبدیل کرنے کے لیے کردار منتخب کریں۔',ur)}</p>}</section>
  {adding&&<div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true"><div className="modal-heading"><h2><ShieldCheck size={17}/> {editingRole?(ur?'کردار میں ترمیم':'Edit role'):(ur?'نیا کردار':'New role')}</h2><button className="row-action" onClick={()=>setAdding(false)} aria-label="Close">✕</button></div><form onSubmit={create}><div className="fields-grid"><label className="form-field">{ur?'کردار کا نام':'Role name'} *<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80}/></label><label className="form-field wide">{ur?'تفصیل':'Description'}<input value={desc} onChange={e=>setDesc(e.target.value)} maxLength={300}/></label>{modules.map(m=><label className="form-field" key={m.key}>{lab(m.en,m.ur,ur)}<SearchSelect value={roleDraft[m.key]||'none'} onChange={e=>setRoleDraft(p=>({...p,[m.key]:e.target.value}))}>{PERM.map(p=><option key={p} value={p}>{lab(LEVEL[p][0],LEVEL[p][1],ur)}</option>)}</SearchSelect></label>)}</div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setAdding(false)}>{ur?'منسوخ':'Cancel'}</button><button className="button" disabled={busy}>{busy?'…':ur?'محفوظ کریں':'Save'}</button></div></form></section></div>}
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
 const [values,setValues]=useState(defaultFarmSettings);const [testRecipient,setTestRecipient]=useState('');const [smtpEditing,setSmtpEditing]=useState(false);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [ok,setOk]=useState('');
 const load=useCallback(async()=>{try{const data=await api(base+'/settings');setValues({...defaultFarmSettings,...data});setError('')}catch(e){setError((e as Error).message)}finally{setLoading(false)}},[base]);
 useEffect(()=>{void load()},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setOk('');try{await api(base+'/settings',{method:'PUT',body:JSON.stringify(values)});setOk(ur?'فارم کی ترتیبات محفوظ ہو گئیں۔':'Farm settings saved.');setSmtpEditing(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
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
  <section className="workspace-panel smtp-panel crm-smtp-panel">
   <div className="crm-smtp-head"><div><span className="smtp-icon"><Mail size={19}/></span><span><h3>{ur?'ای میل کی ترسیل (SMTP)':'Email delivery (SMTP)'}</h3><p>{ur?'اطلاعات، رپورٹس اور خودکار پیغامات کے لیے فارم کا بیرونی میل سرور۔':'The farm outgoing mail server for notifications, reports, and automated messages.'}</p></span></div>{!readOnly&&(smtpEditing?<div><button type="button" className="secondary-button" onClick={()=>{setSmtpEditing(false);void load()}}><X size={14}/>{ur?'منسوخ':'Cancel'}</button><button type="submit" className="button small" disabled={busy}><Save size={14}/>{busy?'…':ur?'محفوظ کریں':'Save'}</button></div>:<button type="button" className="secondary-button" onClick={()=>setSmtpEditing(true)}><Pencil size={14}/>{ur?'ترمیم':'Edit'}</button>)}</div>
   <div className="smtp-status-strip"><span className={values.smtpEnabled==='Enabled'?'smtp-status enabled':'smtp-status'}><i/>{values.smtpEnabled==='Enabled'?(ur?'فعال':'Enabled'):(ur?'غیر فعال':'Disabled')}</span><small>{values.smtpHost||lab('No SMTP server configured','کوئی SMTP سرور ترتیب نہیں دیا گیا',ur)}</small></div>
   <div className="smtp-card"><div className="smtp-card-title"><strong>{ur?'SMTP سرور':'SMTP server'}</strong><small>{ur?'سرور کنکشن اور بھیجنے والے کی شناخت':'Server connection and sender identity'}</small></div><div className="fields-grid smtp-fields">
    <label className="form-field">{ur?'حالت':'Status'}<SearchSelect value={values.smtpEnabled} onChange={e=>setValues(v=>({...v,smtpEnabled:e.target.value}))} disabled={readOnly||!smtpEditing}><option>Disabled</option><option>Enabled</option></SearchSelect></label>
    <label className="form-field">{ur?'سیکیورٹی':'Security'}<SearchSelect value={values.smtpSecurity} onChange={e=>setValues(v=>({...v,smtpSecurity:e.target.value}))} disabled={readOnly||!smtpEditing}><option>STARTTLS</option><option>TLS</option><option>None</option></SearchSelect></label>
    <label className="form-field">{ur?'SMTP ہوسٹ':'SMTP host'}<input value={values.smtpHost} onChange={e=>setValues(v=>({...v,smtpHost:e.target.value}))} disabled={readOnly||!smtpEditing} placeholder="smtp.example.com"/></label>
    <label className="form-field">{ur?'پورٹ':'Port'}<input type="number" min="1" max="65535" value={values.smtpPort} onChange={e=>setValues(v=>({...v,smtpPort:e.target.value}))} disabled={readOnly||!smtpEditing}/></label>
    <label className="form-field">{ur?'صارف نام':'Username'}<input value={values.smtpUsername} onChange={e=>setValues(v=>({...v,smtpUsername:e.target.value}))} disabled={readOnly||!smtpEditing} autoComplete="username"/></label>
    <label className="form-field">{ur?'پاس ورڈ':'Password'}<input type="password" value={values.smtpPassword} onChange={e=>setValues(v=>({...v,smtpPassword:e.target.value}))} disabled={readOnly||!smtpEditing} autoComplete="new-password" placeholder={!smtpEditing&&values.smtpPassword?'••••••••':''}/></label>
    <label className="form-field">{ur?'بھیجنے والے کا نام':'From name'}<input value={values.smtpFromName} onChange={e=>setValues(v=>({...v,smtpFromName:e.target.value}))} disabled={readOnly||!smtpEditing}/></label>
    <label className="form-field">{ur?'بھیجنے والا ای میل':'From email'}<input type="email" value={values.smtpFromEmail} onChange={e=>setValues(v=>({...v,smtpFromEmail:e.target.value}))} disabled={readOnly||!smtpEditing} placeholder="noreply@example.com"/></label>
   </div></div>
   <div className="smtp-card smtp-test-card"><div className="smtp-card-title"><strong><Send size={15}/>{ur?'ٹیسٹ ای میل بھیجیں':'Send test email'}</strong><small>{ur?'کنکشن کی جانچ کریں اور تصدیق کریں کہ ترسیل کام کر رہی ہے۔':'Verify the connection and confirm that delivery is working.'}</small></div><div className="smtp-test-row"><label className="form-field">{ur?'وصول کنندہ':'Recipient'}<input type="email" value={testRecipient} onChange={e=>setTestRecipient(e.target.value)} disabled={readOnly} placeholder="you@example.com"/></label>{!readOnly&&<button type="button" className="secondary-button" disabled={busy||!testRecipient||!values.smtpHost||!values.smtpFromEmail} onClick={()=>void testEmail()}><PlugZap size={15}/>{busy?'…':ur?'کنکشن ٹیسٹ کریں اور بھیجیں':'Test connection & send'}</button>}</div></div>
  </section>
 </form>;
}
function roleLabel(r:string,ur:boolean){return r==='OWNER'?(ur?'مالک':'Owner'):(ur?'صرف دیکھنے والا':'Viewer')}
