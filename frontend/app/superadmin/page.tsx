'use client';
import {Fragment,useCallback,useEffect,useState,type Dispatch,type SetStateAction} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Building2,ChevronDown,ChevronLeft,ChevronRight,ChevronRight as ExpandIcon,LayoutDashboard,RefreshCcw,Search,ShieldCheck,Store,Users,Bell,Database,Settings,LogOut,Activity,XCircle,CheckCircle2,Mail,UserRound,X} from 'lucide-react';
import PlatformBackups from '../../components/platform-backups';
import {api} from '../../components/api';
import {useLanguage} from '../../components/language';
import './superadmin.css';
type Stat=Record<string,string|number>;
type Row=Record<string,any>;
function fmt(v:string|number|undefined,ur:boolean){if(v===undefined||v===null||v==='')return '—';const s=String(v);const d=s.slice(0,10);return /^\d{4}-\d{2}-\d{2}/.test(s)?(ur?d:d):s}
function timeAgo(dateStr:string,ur:boolean){const diff=Date.now()-new Date(dateStr).getTime();if(diff<60000)return ur?'ابھی':'Just now';if(diff<3600000){const m=Math.floor(diff/60000);return ur?`${m} من پہلے`:`${m}m ago`;}if(diff<86400000){const h=Math.floor(diff/3600000);return ur?`${h} گھنٹے پہلے`:`${h}h ago`;}return new Date(dateStr).toLocaleDateString();}
function actionLabel(action:string,ur:boolean){const m:Record<string,string>={'user.suspended':ur?'صارف معطل':'User suspended','user.activated':ur?'صارف فعال':'User activated','farm.suspended':ur?'فارم معطل':'Farm suspended','farm.activated':ur?'فارم فعال':'Farm activated','admin.granted':ur?'ایڈمن دیا گیا':'Admin granted','admin.revoked':ur?'ایڈمن واپس':'Admin revoked','backup.created':ur?'بیک اپ تیار':'Backup created','settings.updated':ur?'ترتیبات اپ ڈیٹ':'Settings updated','settings.smtp.test':ur?'SMTP ٹیسٹ':'SMTP tested'};return m[action]??action;}
type Tk='farms'|'organizations'|'users';
type PgState={farms:number;organizations:number;users:number};
const Seg=({value,onChange,options}:{value:string;onChange:(v:any)=>void;options:[string,string][]})=><div className="admin-seg" role="group" aria-label="Filter">{options.map(([val,label])=><button key={val} type="button" className={value===val?'on':''} onClick={()=>onChange(val)}>{label}</button>)}</div>;
const Pager=({tab:tk,total,page,setPage,ur}:{tab:Tk;total:number;page:PgState;setPage:Dispatch<SetStateAction<PgState>>;ur:boolean})=>{
 const L=(en:string,urdu:string)=>ur?urdu:en;
 const pg=page[tk];const pc=Math.max(1,Math.ceil(total/20));return <div className="admin-pager">{pg>0&&<button className="button small" onClick={()=>setPage(p=>({...p,[tk]:pg-1}))} aria-label={L('Previous page','پچھلا صفحہ')} title={L('Previous','پچھلا')}><ChevronLeft size={14}/></button>}<span>{L('Page','صفحہ')} {pg+1} {L('of','')} {pc}</span>{pg<pc-1&&<button className="button small" onClick={()=>setPage(p=>({...p,[tk]:pg+1}))} aria-label={L('Next page','اگلا صفحہ')} title={L('Next','اگلا')}><ChevronRight size={14}/></button>}</div>;
};
const SearchInput=({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder:string})=><label className="admin-search"><Search size={15}/><input value={value} placeholder={placeholder} aria-label={placeholder} onChange={e=>onChange(e.target.value)}/></label>;
function actionIcon(action:string){if(action.includes('suspend'))return <XCircle size={14}/>;if(action.includes('activ'))return <CheckCircle2 size={14}/>;if(action.includes('backup'))return <Database size={14}/>;if(action.includes('settings'))return <Settings size={14}/>;if(action.includes('admin.grant'))return <ShieldCheck size={14}/>;return <Activity size={14}/>;}
export default function SuperAdmin(){
 const {ur,t,toggle}=useLanguage();
 const router=useRouter();
 const [status,setStatus]=useState<'loading'|'ready'|'denied'|'guest'>('loading');
 const [me,setMe]=useState<{id:string;name:string;email:string;is_superadmin:boolean}|null>(null);
 const [tab,setTab]=useState<'overview'|'farms'|'organizations'|'users'|'activity'|'settings'>('overview');
 const [stats,setStats]=useState<Stat>({});
 const [farms,setFarms]=useState<Row[]>([]);const [farmsTotal,setFarmsTotal]=useState(0);
 const [orgs,setOrgs]=useState<Row[]>([]);const [orgsTotal,setOrgsTotal]=useState(0);
 const [users,setUsers]=useState<Row[]>([]);const [usersTotal,setUsersTotal]=useState(0);
 const [search,setSearch]=useState({farms:'',organizations:'',users:''});
 const [filter,setFilter]=useState<{farms:'all'|'active'|'suspended';userStatus:'all'|'active'|'suspended';role:'all'|'admin'|'customer'}>({farms:'all',userStatus:'all',role:'all'});
 const [page,setPage]=useState({farms:0,organizations:0,users:0});
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const [openUser,setOpenUser]=useState<string|null>(null);

 const [searchQ,setSearchQ]=useState('');
 const [debouncedQ,setDebouncedQ]=useState('');
 const [searchRes,setSearchRes]=useState<{users:{id:string;name:string;email:string;is_active:boolean;is_superadmin:boolean}[];farms:{id:string;name:string;city:string;country:string;is_active:boolean;owner_name?:string}[]}>({users:[],farms:[]});
 const [searchOpen,setSearchOpen]=useState(false);

 const [activity,setActivity]=useState<{rows:{id:string;action:string;record_type:string;record_id:string|null;detail:string|null;created_at:string;admin_name:string|null}[]}>({rows:[]});
 const [actOpen,setActOpen]=useState(false);
 const [actSeen,setActSeen]=useState<string>(()=>{try{return localStorage.getItem('dm_admin_act_seen')??''}catch{return ''}});
 const [notifs,setNotifs]=useState<{rows:{id:string;type:string;target_id:string;target_name:string;detail:string|null;created_at:string}[]}>({rows:[]});
 const [userMenuOpen,setUserMenuOpen]=useState(false);
 const [profileOpen,setProfileOpen]=useState(false);
 const [profName,setProfName]=useState('');
 const [profCur,setProfCur]=useState('');
 const [profNew,setProfNew]=useState('');
 const [profMsg,setProfMsg]=useState<{kind:'ok'|'err';text:string}|null>(null);
 const [profBusy,setProfBusy]=useState(false);

 const [smtp,setSmtp]=useState<{host:string;port:number;secure:boolean;user:string;password:string;fromEmail:string;fromName:string;passwordSet:boolean}>({host:'',port:587,secure:false,user:'',password:'',fromEmail:'',fromName:'DairyMonitor',passwordSet:false});
 const [settingsLoaded,setSettingsLoaded]=useState(false);
 const [settingsSaving,setSettingsSaving]=useState(false);
 const [smtpTesting,setSmtpTesting]=useState(false);

 useEffect(()=>{async function boot(){try{const me=await api('/api/v1/auth/me');setMe(me);if(!me.is_superadmin){setStatus('denied');return;}setStatus('ready')}catch(e){if((e as Error).message==='Please sign in'){setStatus('guest');setTimeout(()=>router.replace('/signin?next=/superadmin'),600)}else{setStatus('denied')}}}void boot()},[router]);
 const loadStats=useCallback(async()=>{try{setStats(await api('/api/v1/admin/stats'))}catch(e){setMessage({kind:'err',text:(e as Error).message})}},[]);
 const loadFarms=useCallback(async()=>{setLoading(true);setMessage(null);try{const d=await api(`/api/v1/admin/farms?search=${encodeURIComponent(search.farms)}&status=${filter.farms}&limit=20&offset=${page.farms*20}`);setFarms(d.rows);setFarmsTotal(d.total)}catch(e){setMessage({kind:'err',text:(e as Error).message})}finally{setLoading(false)}},[search.farms,page.farms,filter.farms]);
 const loadOrgs=useCallback(async()=>{setLoading(true);setMessage(null);try{const d=await api(`/api/v1/admin/organizations?search=${encodeURIComponent(search.organizations)}&limit=20&offset=${page.organizations*20}`);setOrgs(d.rows);setOrgsTotal(d.total)}catch(e){setMessage({kind:'err',text:(e as Error).message})}finally{setLoading(false)}},[search.organizations,page.organizations]);
 const loadUsers=useCallback(async()=>{setLoading(true);setMessage(null);try{const d=await api(`/api/v1/admin/users?search=${encodeURIComponent(search.users)}&status=${filter.userStatus}&role=${filter.role}&limit=20&offset=${page.users*20}`);setUsers(d.rows);setUsersTotal(d.total)}catch(e){setMessage({kind:'err',text:(e as Error).message})}finally{setLoading(false)}},[search.users,page.users,filter.userStatus,filter.role]);
 useEffect(()=>{if(status==='ready'&&tab==='overview')void loadStats()},[status,tab,loadStats]);
 useEffect(()=>{if(status==='ready'&&tab==='farms')void loadFarms()},[status,tab,loadFarms]);
 useEffect(()=>{if(status==='ready'&&tab==='organizations')void loadOrgs()},[status,tab,loadOrgs]);
 useEffect(()=>{if(status==='ready'&&tab==='users')void loadUsers()},[status,tab,loadUsers]);

 useEffect(()=>{const t=setTimeout(()=>setDebouncedQ(searchQ),300);return ()=>clearTimeout(t);},[searchQ]);
 useEffect(()=>{if(debouncedQ.length>=2){fetch(`/api/v1/admin/search?q=${encodeURIComponent(debouncedQ)}`,{credentials:'include'}).then(r=>r.ok?r.json():null).then(d=>setSearchRes(d??{users:[],farms:[]})).catch(()=>setSearchRes({users:[],farms:[]}))}else setSearchRes({users:[],farms:[]})},[debouncedQ]);
 useEffect(()=>{if(status==='ready'){fetch('/api/v1/admin/activity?limit=50',{credentials:'include'}).then(r=>r.ok?r.json():{rows:[]}).then(setActivity).catch(()=>setActivity({rows:[]}))}},[status]);
 useEffect(()=>{if(status!=='ready')return;const load=()=>fetch('/api/v1/admin/notifications?limit=12',{credentials:'include'}).then(r=>r.ok?r.json():{rows:[]}).then(setNotifs).catch(()=>setNotifs({rows:[]}));load();const t=setInterval(load,30000);return ()=>clearInterval(t);},[status]);
 const actNew=actSeen?notifs.rows.filter(r=>new Date(r.created_at)>new Date(actSeen)).length:notifs.rows.length;
 function markActSeen(){const t=new Date().toISOString();setActSeen(t);try{localStorage.setItem('dm_admin_act_seen',t)}catch{}}

 useEffect(()=>{if(status==='ready'&&!settingsLoaded){fetch('/api/v1/admin/settings',{credentials:'include'}).then(r=>r.ok?r.json():null).then(d=>{if(d){setSmtp(s=>({...s,...d.smtp}));setSettingsLoaded(true)}}).catch(()=>{})}},[status,settingsLoaded]);

 async function act(path:string,body:Record<string,unknown>,okMsg:string){setMessage(null);try{await api(path,{method:'POST',body:JSON.stringify(body)});setMessage({kind:'ok',text:okMsg});}catch(e){setMessage({kind:'err',text:(e as Error).message});return;}if(tab==='farms')void loadFarms();else if(tab==='organizations')void loadOrgs();else if(tab==='users')void loadUsers();else void loadStats();}
 async function saveProfile(e:React.FormEvent){e.preventDefault();setProfMsg(null);setProfBusy(true);try{await api('/api/v1/auth/profile',{method:'PUT',body:JSON.stringify({name:profName})});if(profNew)await api('/api/v1/auth/change-password',{method:'POST',body:JSON.stringify({current_password:profCur,new_password:profNew})});setMe(m=>m?{...m,name:profName}:m);setProfileOpen(false);setMessage({kind:'ok',text:L('Profile updated.','پروفائل اپ ڈیٹ ہو گئی۔')});}catch(e){setProfMsg({kind:'err',text:(e as Error).message})}finally{setProfBusy(false)}}
 const L=(en:string,urdu:string)=>ur?urdu:en;
 const overviewStats:[keyof Stat,string][]=[
  ['users',L('Registered users','رجسٹرڈ صارفین')],['active_users',L('Active users','فعال صارفین')],['farms',L('Farms','فارمز')],['active_farms',L('Active farms','فعال فارمز')],['suspended_farms',L('Suspended farms','معطل فارمز')],['organizations',L('Organizations','تنظیمیں')],['animals',L('Animals','جانور')],['lactating',L('Lactating','دودھ دینے والے')],['milk_today',L('Milk today (L)','آج کا دودھ (لٹر)')],['superadmins',L('Superadmins','سپر ایڈمنز')],['active_sessions',L('Active sessions','فعال سیشنز')]
 ];
 const tabs:[string,string,React.ElementType][]=[
  ['overview',L('Overview','جائزہ'),LayoutDashboard],['farms',L('Farms','فارمز'),Store],['organizations',L('Organizations','تنظیمیں'),Building2],['users',L('Users','صارفین'),Users],['activity',L('Activity','سرگرمی'),Bell],['settings',L('Settings','ترتیبات'),Settings]
 ];
 return <div className="admin-shell">
  <div className="admin-topbar">
   <div className="admin-topbar-inner">
    <button className="admin-back" onClick={()=>router.push('/dashboard')} aria-label={L('Back to dashboard','واپس ڈیش بورڈ')} title={L('Dashboard','ڈیش بورڈ')}><ArrowLeft size={16}/></button>
    <span className="admin-brandmark"><ShieldCheck size={17}/></span>
    <div className="admin-brand"><strong>{L('Superadmin','سپر ایڈمن')}</strong><small>DairyMonitor · {L('Platform control','پلیٹ فارم کنٹرول')}</small></div>
    <div className="admin-topbar-right">
     <div className="admin-global-search-wrap">
      <label className="admin-global-search">
       <Search size={14}/>
       <input value={searchQ} placeholder={L('Search users, farms…','صارفین، فارمز تلاش…')} aria-label={L('Global search','سرچ')} onChange={e=>setSearchQ(e.target.value)} onFocus={()=>setSearchOpen(true)} onBlur={()=>setTimeout(()=>setSearchOpen(false),150)}/>
      </label>
      {searchOpen&&debouncedQ.length>=2&&<div className="admin-search-results" role="listbox">
       {searchRes.users.length===0&&searchRes.farms.length===0&&<div className="admin-search-empty">{L('No results','کوئی نتیجہ نہیں')}</div>}
       {searchRes.users.length>0&&<div className="admin-search-group"><span className="admin-search-cap">{L('Users','صارفین')}</span>{searchRes.users.map(u=><button key={u.id} className="admin-search-item" onMouseDown={()=>{setTab('users');setSearchQ('');setSearchOpen(false);setSearch(s=>({...s,users:u.name}))}}><span className="admin-avatar sm">{u.name.slice(0,2)}</span><span className="admin-search-label"><strong>{u.name}</strong><small>{u.email}</small></span></button>)}</div>}
       {searchRes.farms.length>0&&<div className="admin-search-group"><span className="admin-search-cap">{L('Farms','فارمز')}</span>{searchRes.farms.map(f=><button key={f.id} className="admin-search-item" onMouseDown={()=>{setTab('farms');setSearchQ('');setSearchOpen(false);setSearch(s=>({...s,farms:f.name}))}}><span className="admin-avatar sm farm">{f.name.slice(0,2)}</span><span className="admin-search-label"><strong>{f.name}</strong><small>{[f.city,f.country].filter(Boolean).join(', ')}</small></span></button>)}</div>}
      </div>}
     </div>
     <div className="admin-bell-wrap">
      <button className="admin-bell" onClick={()=>{if(!actOpen)markActSeen();setActOpen(o=>!o)}} aria-label={L('Activity','سرگرمی')} title={L('Activity','سرگرمی')}>
       <Bell size={18}/>
       {actNew>0&&<span className="admin-bell-badge">{actNew>99?'99+':actNew}</span>}
      </button>
      {actOpen&&<div className="admin-bell-drop">
       <div className="admin-bell-head"><strong>{L('Notifications','اطلاعات')}</strong></div>
       <div className="admin-bell-body">
        {notifs.rows.length===0?<div className="admin-bell-empty">{L('No notifications yet','ابھی تک کوئی اطلاع نہیں')}</div>:notifs.rows.map(r=><div className="admin-bell-row" key={r.id}><span className="admin-bell-ico">{r.type==='farm.created'?<Store size={14}/>:<UserRound size={14}/>}</span><div className="admin-bell-info"><strong>{r.type==='farm.created'?L('New farm','نیا فارم'):L('New account','نیا اکاؤنٹ')}</strong><span>{r.target_name}</span>{r.detail?<small>{r.detail.slice(0,60)}</small>:null}</div><span className="admin-bell-time">{timeAgo(r.created_at,ur)}</span></div>)}
       </div>
       <div className="admin-bell-foot"><button className="button small" onClick={()=>{setTab('activity');setActOpen(false)}}>{L('View full activity log','مکمل سرگرمی دیکھیں')}</button></div>
      </div>}
     </div>
     <div className="admin-user-wrap">
      <button className="admin-user" onClick={()=>setUserMenuOpen(o=>!o)} aria-label={L('Account menu','اکاؤنٹ مینو')} aria-expanded={userMenuOpen} title={me?.name}>
       {me&&<span className="admin-avatar">{me.name.slice(0,2).toUpperCase()}</span>}
       {me&&<span className="admin-user-name">{me.name}</span>}
       <ChevronDown size={14} className="admin-user-caret"/>
      </button>
      {userMenuOpen&&<div className="admin-user-menu">
       <div className="admin-user-head"><strong>{me?.name}</strong><small>{me?.email}</small></div>
       <button className="admin-user-opt" onClick={()=>{setUserMenuOpen(false);setProfName(me?.name??'');setProfCur('');setProfNew('');setProfMsg(null);setProfileOpen(true)}}><UserRound size={15}/>{L('Update profile','پروفائل اپ ڈیٹ کریں')}</button>
       <button className="admin-user-opt danger" onClick={async()=>{try{await fetch('/api/v1/auth/logout',{method:'POST'});router.replace('/signin')}catch{}}}><LogOut size={15}/>{L('Sign out','لاگ آؤٹ')}</button>
      </div>}
     </div>
     <div className="lang-switch" role="group" aria-label={L('Language','زبان')}><button className={ur?'':'on'} onClick={()=>{if(ur)toggle()}} aria-pressed={!ur}>English</button><button className={ur?'on':''} onClick={()=>{if(!ur)toggle()}} aria-pressed={ur}>اردو</button></div>
    </div>
   </div>
  </div>
  {status==='guest'&&<div className="admin-content"><div className="form-error" role="alert">{L('Checking your session…','سیشن چیک ہو رہا ہے…')}</div></div>}
  {status==='denied'&&<div className="admin-body"><div className="admin-content"><div className="admin-denied"><ShieldCheck size={40}/><h1>{L('Admin access required','ایڈمن رسائی درکار ہے')}</h1><p>{L('Only platform administrators can open this panel.','صرف پلیٹ فارم منتظمین اس پینل کو کھول سکتے ہیں۔')}</p><button className="button" onClick={()=>router.push('/dashboard')}>{L('Back to dashboard','واپس ڈیش بورڈ')}</button></div></div></div>}
  {status==='ready'&&<div className="admin-body">
   <aside className="admin-sidebar" aria-label={L('Admin sections','ایڈمن حصے')}>
    <div className="admin-sidebar-brand"><span className="admin-brandmark lg"><ShieldCheck size={18}/></span><div><strong>DairyMonitor</strong><small>ONLINE</small></div></div>
    <nav className="admin-nav">
     <small className="admin-nav-cap">{L('PLATFORM','پلیٹ فارم')}</small>
     {tabs.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key as any);setMessage(null);setOpenUser(null)}}><span className="admin-nav-ico"><Icon size={16}/></span><span>{label}</span></button>)}
    </nav>
   </aside>
   <main className="admin-main">
    {message&&<div className={message.kind==='ok'?'admin-message ok':'admin-message err'} role="status">{message.text}</div>}
    {tab==='overview'&&<>
     <div className="admin-page-head"><div><h1>{L('Platform overview','پلیٹ فارم کا جائزہ')}</h1><p>{L('Live figures across the whole platform.','پورے پلیٹ فارم کے موجودہ اعداد و شمار۔')}</p></div><button className="button small" onClick={()=>void loadStats()} aria-label={L('Refresh','تازہ کریں')} title={L('Refresh','تازہ کریں')}><RefreshCcw size={14}/>{L('Refresh','تازہ کریں')}</button></div>
     <div className="admin-stats">
      {overviewStats.map(([key,label])=><div className="admin-stat" key={key}><span>{label}</span><strong className={key==='suspended_farms'&&Number(stats.suspended_farms)>0?'warn':''}>{String(stats[key]??'0')}</strong></div>)}
     </div>
     <div className="admin-note"><RefreshCcw size={13}/>{L('Use the navigation to manage farms, organizations, customers, activity and settings.','فارمز، تنظیمیں، صارفین، سرگرمی اور ترتیبات کے انتظام کے لیے نیویگیشن استعمال کریں۔')}</div>
    </>}
    {tab==='farms'&&<>
     <div className="admin-page-head"><div><h1>{L('Farms','فارمز')}</h1><p>{L('Every registered dairy farm across the platform.','پلیٹ فارم کے تمام رجسٹرڈ ڈیری فارم۔')}</p></div><span className="admin-count">{L('Showing','دکھا رہا ہے')} {farms.length} {L('of','')} {farmsTotal}</span></div>
     <div className="admin-toolbar"><SearchInput value={search.farms} onChange={v=>{setSearch(s=>({...s,farms:v}));setPage(p=>({...p,farms:0}))}} placeholder={L('Search name, city, owner…','نام، شہر یا مالک تلاش کریں…')}/><Seg value={filter.farms} onChange={v=>{setFilter(f=>({...f,farms:v}));setPage(p=>({...p,farms:0}))}} options={[['all',L('All','تمام')],['active',L('Active','فعال')],['suspended',L('Suspended','معطل')]]}/></div>
     {loading?<div className="admin-message err">{L('Loading…','لوڈ ہو رہا ہے…')}</div>:farms.length===0?<div className="table-empty"><Store size={30}/><p>{L('No farms match your filters.','آپ کے فلٹرز سے مماثل کوئی فارم نہیں۔')}</p></div>:<div className="records-table-wrap"><table className="records-table"><thead><tr><th>{L('Farm','فارم')}</th><th>{L('Organization','تنظیم')}</th><th>{L('Owner','مالک')}</th><th className="num">{L('Animals','جانور')}</th><th className="num">{L('Members','ارکان')}</th><th>{L('Status','حالت')}</th><th>{L('Created','تاریخ')}</th><th>{L('Actions','اقدامات')}</th></tr></thead><tbody>{farms.map(f=><tr key={f.id}><td><strong>{f.name}</strong><small>{[f.city,f.country].filter(Boolean).join(', ')}</small></td><td>{f.organization_name||'—'}</td><td>{f.owner_name?<>{f.owner_name}<small>{f.owner_email}</small></>:<small>—</small>}</td><td className="num">{f.animal_count}</td><td className="num">{f.member_count}</td><td><span className={`admin-chip ${f.is_active?'ok':'bad'}`}><i/>{f.is_active?L('Active','فعال'):L('Suspended','معطل')}</span></td><td>{fmt(f.created_at,ur)}</td><td className="actions-c"><button className="row-action" disabled={loading} onClick={()=>void act(`/api/v1/admin/farms/${f.id}/status`,{is_active:!f.is_active},f.is_active?L('Farm suspended','فارم معطل کر دیا گیا'):L('Farm activated','فارم فعال کر دیا گیا'))}>{f.is_active?L('Suspend','معطل کریں'):L('Activate','فعال کریں')}</button></td></tr>)}</tbody></table></div>}
     <Pager tab="farms" total={farmsTotal} page={page} setPage={setPage} ur={ur}/>
    </>}
    {tab==='organizations'&&<>
     <div className="admin-page-head"><div><h1>{L('Organizations','تنظیمیں')}</h1><p>{L('Customer workspaces and their memberships.','کسٹمر ورک اسپیسز اور ان کی رکنیت۔')}</p></div><span className="admin-count">{L('Showing','دکھا رہا ہے')} {orgs.length} {L('of','')} {orgsTotal}</span></div>
     <div className="admin-toolbar"><SearchInput value={search.organizations} onChange={v=>{setSearch(s=>({...s,organizations:v}));setPage(p=>({...p,organizations:0}))}} placeholder={L('Search organizations…','تنظیمیں تلاش کریں…')}/></div>
     {loading?<div className="admin-message err">{L('Loading…','لوڈ ہو رہا ہے…')}</div>:orgs.length===0?<div className="table-empty"><Building2 size={30}/><p>{L('No organizations match your search.','آپ کی تلاش سے مماثل کوئی تنظیم نہیں۔')}</p></div>:<div className="records-table-wrap"><table className="records-table"><thead><tr><th>{L('Organization','تنظیم')}</th><th>{L('Owner','مالک')}</th><th className="num">{L('Members','ارکان')}</th><th className="num">{L('Farms','فارمز')}</th><th className="num">{L('Suspended','معطل')}</th><th>{L('Created','تاریخ')}</th></tr></thead><tbody>{orgs.map(o=><tr key={o.id}><td><strong>{o.name}</strong><small>{o.slug}</small></td><td>{o.owner_name?<>{o.owner_name}<small>{o.owner_email}</small></>:<small>—</small>}</td><td className="num">{o.member_count}</td><td className="num">{o.farm_count}</td><td className="num">{Number(o.suspended_count)>0?<span className="admin-chip bad"><i/>{o.suspended_count}</span>:'0'}</td><td>{fmt(o.created_at,ur)}</td></tr>)}</tbody></table></div>}
     <Pager tab="organizations" total={orgsTotal} page={page} setPage={setPage} ur={ur}/>
    </>}
    {tab==='users'&&<>
     <div className="admin-page-head"><div><h1>{L('Users & customers','صارفین')}</h1><p>{L('Registered customers with their farms and live production.','رجسٹرڈ صارفین ان کے فارمز اور پیداوار کے ساتھ۔')}</p></div><span className="admin-count">{L('Showing','دکھا رہا ہے')} {users.length} {L('of','')} {usersTotal}</span></div>
     <div className="admin-toolbar"><SearchInput value={search.users} onChange={v=>{setSearch(s=>({...s,users:v}));setPage(p=>({...p,users:0}))}} placeholder={L('Search name or email…','نام یا ای میل تلاش کریں…')}/><Seg value={filter.userStatus} onChange={v=>{setFilter(f=>({...f,userStatus:v}));setPage(p=>({...p,users:0}))}} options={[['all',L('All','تمام')],['active',L('Active','فعال')],['suspended',L('Suspended','معطل')]]}/><Seg value={filter.role} onChange={v=>{setFilter(f=>({...f,role:v}));setPage(p=>({...p,users:0}))}} options={[['all',L('All roles','تمام کردار')],['admin',L('Admins','ایڈمنز')],['customer',L('Customers','صارفین')]]}/></div>
     {loading?<div className="admin-message err">{L('Loading…','لوڈ ہو رہا ہے…')}</div>:users.length===0?<div className="table-empty"><Users size={30}/><p>{L('No users match your filters.','آپ کے فلٹرز سے مماثل کوئی صارف نہیں۔')}</p></div>:<div className="records-table-wrap"><table className="records-table"><thead><tr><th className="expand-c">{L('Farms','فارمز')}</th><th>{L('User','صارف')}</th><th className="num">{L('Farms','فارمز')}</th><th className="num">{L('Orgs','تنظیمیں')}</th><th>{L('Role','کردار')}</th><th>{L('Status','حالت')}</th><th>{L('Joined','تاریخ')}</th><th>{L('Actions','اقدامات')}</th></tr></thead><tbody>{users.map(u=><Fragment key={u.id}><tr><td className="expand-c"><button className="row-action" onClick={()=>setOpenUser(o=>o===u.id?null:u.id)} aria-expanded={openUser===u.id} aria-label={openUser===u.id?L('Collapse farms','فارمز بند کریں'):L(`Show ${u.name}'s farms`,`${u.name} کے فارمز`)} title={L('Show farms','فارمز دکھائیں')}><ExpandIcon size={17} className={openUser===u.id?'rotated':''}/></button></td><td><strong>{u.name}</strong><small>{u.email}</small></td><td className="num">{u.farm_count}</td><td className="num">{u.org_count}</td><td>{u.is_superadmin?<span className="admin-chip admin"><i/>{L('Superadmin','سپر ایڈمن')}</span>:<span className="admin-chip">{L('Customer','صارف')}</span>}</td><td><span className={`admin-chip ${u.is_active?'ok':'bad'}`}><i/>{u.is_active?L('Active','فعال'):L('Suspended','معطل')}</span></td><td>{fmt(u.created_at,ur)}</td><td className="actions-c">{u.id!==me?.id&&<button className="row-action" disabled={loading} onClick={()=>void act(`/api/v1/admin/users/${u.id}/status`,{is_active:!u.is_active},u.is_active?L('User suspended','صارف معطل کر دیا گیا'):L('User activated','صارف فعال کر دیا گیا'))}>{u.is_active?L('Suspend','معطل کریں'):L('Activate','فعال کریں')}</button>}</td></tr>{openUser===u.id&&<tr className="admin-subrow"><td colSpan={8}><div className="admin-subcard">{Array.isArray(u.farms)&&u.farms.length===0?<p className="sub-empty">{L('This user has no dairy farms.','اس صارف کے پاس کوئی ڈیری فارم نہیں۔')}</p>:<div className="records-table-wrap sub"><table className="records-table"><thead><tr><th>{L('Farm','فارم')}</th><th>{L('Status','حالت')}</th><th className="num">{L('Users','صارفین')}</th><th className="num">{L('Staff','عملہ')}</th><th className="num">{L('Animals','جانور')}</th><th className="num">{L('Milk total (L)','کل دودھ (لٹر)')}</th><th>{L('Actions','اقدامات')}</th></tr></thead><tbody>{u.farms.map((f:any)=><tr key={f.id}><td><strong>{f.name}</strong>{f.city?<small>{f.city}</small>:null}</td><td><span className={`admin-chip ${f.is_active?'ok':'bad'}`}><i/>{f.is_active?L('Active','فعال'):L('Suspended','معطل')}</span></td><td className="num">{f.members}</td><td className="num">{f.staff}</td><td className="num">{f.animals}</td><td className="num">{Number(f.milk_total).toLocaleString('en-US',{maximumFractionDigits:2})}</td><td className="actions-c"><button className="row-action" disabled={loading} onClick={()=>void act(`/api/v1/admin/farms/${f.id}/status`,{is_active:!f.is_active},f.is_active?L('Farm suspended','فارم معطل کر دیا گیا'):L('Farm activated','فارم فعال کر دیا گیا'))}>{f.is_active?L('Suspend','معطل کریں'):L('Activate','فعال کریں')}</button></td></tr>)}</tbody></table></div>}</div></td></tr>}</Fragment>)}</tbody></table></div>}
     <Pager tab="users" total={usersTotal} page={page} setPage={setPage} ur={ur}/>
    </>}
    {tab==='activity'&&<>
     <div className="admin-page-head"><div><h1>{L('Activity log','سرگرمی لاگ')}</h1><p>{L('Recent platform changes by administrators.','منتظموں کی حالیہ پلیٹ فارم تبدیلیاں۔')}</p></div></div>
     {activity.rows.length===0?<div className="table-empty"><Activity size={30}/><p>{L('No activity recorded yet.','ابھی تک کوئی سرگرمی درج نہیں۔')}</p></div>:<div className="records-table-wrap"><table className="records-table"><thead><tr><th>{L('Time','وقت')}</th><th>{L('Admin','ایڈمن')}</th><th>{L('Action','عمل')}</th><th>{L('Target','موضوع')}</th></tr></thead><tbody>{activity.rows.map(r=><tr key={r.id}><td>{timeAgo(r.created_at,ur)}</td><td>{r.admin_name??L('System','سسٹم')}</td><td><span className="admin-chip">{actionIcon(r.action)} {actionLabel(r.action,ur)}</span></td><td>{r.record_type}<small>{r.detail??'—'}</small></td></tr>)}</tbody></table></div>}
    </>}
    {tab==='settings'&&<>
     <div className="admin-page-head"><div><h1>{L('Settings','ترتیبات')}</h1><p>{L('Configure platform services — email, backups and more.','پلیٹ فارم خدمات کی ترتیب — ای میل، بیک اپ وغیرہ۔')}</p></div></div>
     <div className="admin-settings">
      <section className="admin-settings-section">
       <h3><Mail size={15}/> {L('Email (SMTP)','ای میل (SMTP)')}</h3>
       <p className="admin-settings-desc">{L('Outgoing email server for notifications and alerts.','اطلاعات کے لیے براہ کست ای میل سرور۔')}</p>
       <div className="admin-settings-grid">
        <label className="admin-settings-field"><span>{L('Host','ہوسٹ')}</span><input value={smtp.host} onChange={e=>setSmtp(s=>({...s,host:e.target.value}))} placeholder="smtp.example.com"/></label>
        <label className="admin-settings-field"><span>{L('Port','پورٹ')}</span><input type="number" min={1} max={65535} value={smtp.port} onChange={e=>setSmtp(s=>({...s,port:Number(e.target.value)}))}/></label>
        <label className="admin-settings-field"><span>{L('Secure (TLS)','محفوظ (TLS)')}</span><select value={smtp.secure?'1':'0'} onChange={e=>setSmtp(s=>({...s,secure:e.target.value==='1'}))}><option value="0">No</option><option value="1">Yes</option></select></label>
        <label className="admin-settings-field"><span>{L('Username','صارف نام')}</span><input value={smtp.user} onChange={e=>setSmtp(s=>({...s,user:e.target.value}))} placeholder={L('Optional','اختیاری')}/></label>
        <label className="admin-settings-field"><span>{L('Password','پاسورڈ')}</span><input type="password" value={smtp.password} onChange={e=>setSmtp(s=>({...s,password:e.target.value}))} placeholder={smtp.passwordSet?L('•••••• (saved)','•••••• (محفوظ)'):L('Not set','سیٹ نہیں')}/></label>
        <label className="admin-settings-field"><span>{L('From email','بھیجنے والا ای میل')}</span><input type="email" value={smtp.fromEmail} onChange={e=>setSmtp(s=>({...s,fromEmail:e.target.value}))} placeholder="alerts@dairymonitor.online"/></label>
        <label className="admin-settings-field full"><span>{L('From name','بھیجنے والا نام')}</span><input value={smtp.fromName} onChange={e=>setSmtp(s=>({...s,fromName:e.target.value}))} placeholder="DairyMonitor"/></label>
       </div>
       <div className="admin-settings-actions">
        <button className="button small" disabled={settingsSaving} onClick={async()=>{setSettingsSaving(true);try{await api('/api/v1/admin/settings',{method:'POST',body:JSON.stringify({section:'smtp',value:smtp})});setMessage({kind:'ok',text:L('SMTP settings saved','SMTP ترتیبات محفوظ ہو گئیں')})}catch(e){setMessage({kind:'err',text:(e as Error).message})}finally{setSettingsSaving(false)}}}>{settingsSaving?L('Saving…','محفوظ ہو رہا ہے…'):L('Save SMTP settings','SMTP ترتیبات محفوظ کریں')}</button>
        <button className="button small secondary" disabled={smtpTesting} onClick={async()=>{setSmtpTesting(true);setMessage(null);try{const r=await api('/api/v1/admin/settings/smtp/test',{method:'POST'});setMessage({kind:'ok',text:`${L('SMTP connected','SMTP کنیکٹ ہو گیا')}: ${r.banner}`})}catch(e){setMessage({kind:'err',text:(e as Error).message})}finally{setSmtpTesting(false)}}}>{smtpTesting?L('Testing…','ٹیسٹ ہو رہا ہے…'):L('Test connection','کنکشن ٹیسٹ کریں')}</button>
       </div>
      </section>
      <PlatformBackups ur={ur}/>
     </div>
    </>}
   </main>
  </div>}
  <footer className="app-footer"><span>DairyMonitor <strong>ONLINE</strong> · {L('Superadmin','سپر ایڈمن')}</span><span>© {new Date().getFullYear()} · {L('Platform administration','پلیٹ فارم انتظامیہ')}</span></footer>
  {profileOpen&&<div className="admin-modal" role="dialog" aria-modal="true" aria-label={L('Update profile','پروفائل اپ ڈیٹ')} onClick={()=>setProfileOpen(false)}>
   <div className="admin-modal-card" onClick={e=>e.stopPropagation()}>
    <div className="admin-modal-head"><strong>{L('Update profile','پروفائل اپ ڈیٹ کریں')}</strong><button className="admin-modal-x" onClick={()=>setProfileOpen(false)} aria-label={L('Close','بند کریں')}><X size={16}/></button></div>
    <form onSubmit={saveProfile} className="admin-modal-form">
     <label className="admin-field">{L('Email','ای میل')}<strong className="admin-field-ro">{me?.email}</strong></label>
     <label className="admin-field">{L('Full name','پورا نام')}<input value={profName} onChange={e=>setProfName(e.target.value)} required minLength={2} maxLength={100}/></label>
     <label className="admin-field">{L('Change password (optional)','پاس ورڈ تبدیل کریں (اختیاری)')}<input type="password" value={profNew} onChange={e=>setProfNew(e.target.value)} minLength={6} maxLength={72} autoComplete="new-password"/></label>
     <label className="admin-field">{L('Current password','موجودہ پاس ورڈ')}<input type="password" value={profCur} onChange={e=>setProfCur(e.target.value)} autoComplete="current-password"/></label>
     {profNew&&!profCur&&<div className="form-error">{L('Enter your current password to change it.','پاس ورڈ تبدیل کرنے کے لیے موجودہ پاس ورڈ درج کریں۔')}</div>}
     {profMsg&&<div className={profMsg.kind==='ok'?'admin-message ok':'admin-message err'}>{profMsg.text}</div>}
     <div className="admin-modal-actions"><button type="button" className="button secondary" onClick={()=>setProfileOpen(false)}>{L('Cancel','منسوخ')}</button><button className="button" disabled={profBusy||(!!profNew&&!profCur)}>{profBusy?L('Saving…','محفوظ ہو رہا ہے…'):L('Save changes','تبدیلیاں محفوظ کریں')}</button></div>
    </form>
   </div>
  </div>}
 </div>;
}
