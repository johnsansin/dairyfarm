'use client';
import SearchSelect from './search-select-v2';
import {useEffect,useRef,useState} from 'react';
import {Bell,LogOut,Search,UserRound,ChevronDown,Building2,Moon,Sun,Menu} from 'lucide-react';
import Brand from './brand';
import {api} from './api';
interface Farm{id:string;name:string;city:string;currency:string;role:string;organization_name?:string|null;organization_slug?:string|null}
interface Notification{id:string;type:string;title:string;body:string;link:string;is_read:boolean;created_at:string}
export default function Header({ur,toggle,dark,toggleDark,user,farms,selected,onSelect,base,busy,onLogout,onProfile,onSettings,onDashboard,menuOpen,onMenu}:{
 ur:boolean;toggle:()=>void;dark:boolean;toggleDark:()=>void;user:{name:string}|null;farms:Farm[];selected:string;onSelect:(v:string)=>void;base:(farmId:string)=>string;busy:boolean;onLogout:()=>void;onProfile:()=>void;onSettings:()=>void;onDashboard:()=>void;menuOpen:boolean;onMenu:()=>void;
}){
 const [query,setQuery]=useState('');const [results,setResults]=useState<{id:string;tag:string;name:string|null|undefined;farmId:string;farmName:string}[]>([]);const [searching,setSearching]=useState(false);const [showResults,setShowResults]=useState(false);
 const [notifOpen,setNotifOpen]=useState(false);const [notifs,setNotifs]=useState<Notification[]>([]);const [unread,setUnread]=useState(0);const [loadingNotifs,setLoadingNotifs]=useState(false);
 const [notifError,setNotifError]=useState('');const [notifBusy,setNotifBusy]=useState(false);
const [userMenu,setUserMenu]=useState(false);
 const [settingsAllowed,setSettingsAllowed]=useState(false);
  const [selectedFarm,setSelectedFarm]=useState<Farm|undefined>(farms.find(f=>f.id===selected));
 useEffect(()=>{setSelectedFarm(farms.find(f=>f.id===selected))},[farms,selected]);
 useEffect(()=>{if(!selected){setSettingsAllowed(false);return}api(base(selected)+'/access').then(a=>setSettingsAllowed(a.role==='OWNER'||['read','write'].includes(a.permissions?.settings))).catch(()=>setSettingsAllowed(false))},[selected,base]);
 useEffect(()=>{const h=(e:MouseEvent)=>{const t=e.target;if(!(t instanceof Element)||!t.closest('.global-search, .notif-bell, .user-menu')){setShowResults(false);setNotifOpen(false);setUserMenu(false)}};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[]);
 useEffect(()=>{setNotifs([]);setUnread(0);setNotifError('');if(!selected)return;let alive=true;async function load(){setLoadingNotifs(true);try{const d=await api(base(selected)+'/notifications');if(!alive)return;setNotifs(d.rows);setUnread(d.unread);setNotifError('')}catch(e){if(alive)setNotifError((e as Error).message)}finally{if(alive)setLoadingNotifs(false)}}void load();const timer=setInterval(load,60000);return()=>{alive=false;clearInterval(timer)}},[notifOpen,selected,base]);
 const debounce=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);useEffect(()=>{if(!selected)return;clearTimeout(debounce.current);const q=query.trim();if(q.length<2){setResults([]);setSearching(false);return}setSearching(true);debounce.current=setTimeout(async()=>{
  const out:{id:string;tag:string;name:string|null|undefined;farmId:string;farmName:string}[]=[];
  for(const f of farms){try{const d=await api(base(f.id)+'/options/animals?search='+encodeURIComponent(q));for(const a of d)out.push({...a,farmId:f.id,farmName:f.name});}catch{/*skip*/}}
  setResults(out.slice(0,20));setSearching(false);setShowResults(true);
 },250);return()=>{clearTimeout(debounce.current);}}, [query,selected,farms,base]);
 async function openNotification(n:Notification){setNotifBusy(true);setNotifError('');try{if(!n.is_read){await api(base(selected)+'/notifications/'+n.id+'/read',{method:'POST'});setUnread(u=>Math.max(0,u-1));setNotifs(prev=>prev.map(x=>x.id===n.id?{...x,is_read:true}:x));}setNotifOpen(false);if(n.link?.startsWith('/')&&!n.link.startsWith('//'))window.location.href=n.link;}catch(e){setNotifError((e as Error).message)}finally{setNotifBusy(false)}}
 async function markAll(){setNotifBusy(true);setNotifError('');try{await api(base(selected)+'/notifications/read-all',{method:'POST'});setUnread(0);setNotifs(prev=>prev.map(x=>({...x,is_read:true})))}catch(e){setNotifError((e as Error).message)}finally{setNotifBusy(false)}}
 const farm=selectedFarm;
 return <header className="app-header">
<div className="header-inner">
  <button className="menu-btn" onClick={onMenu} aria-label={ur?'مینو کھولیں / بند کریں':'Toggle menu'} aria-expanded={menuOpen} aria-controls="farm-navigation" title={ur?'مینو':'Menu'}>{<Menu size={19}/>}</button>
  <Brand href={`/dashboard${selected?`?farm=${selected}`:''}`} onClick={onDashboard}/>
  <div className="global-search">
    <Search size={16}/>
    <input value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>query.trim().length>=2&&setShowResults(true)} placeholder={ur?'دنیا بھر میں تلاش کریں (جانور)':'Search animals across farms…'} aria-label={ur?'تلاش':'Search'}/>
    {query.trim().length>=2&&<button className="search-clear" onClick={()=>{setQuery('');setShowResults(false)}} aria-label="Clear">×</button>}
    {searching&&<span className="search-spinner" role="status"/>}
    {(showResults)&&<div className="search-results" role="listbox">
     {searching&&<div className="search-note">{ur?'تلاش ہو رہی ہے…':'Searching…'}</div>}
     {!searching&&results.length===0&&<div className="search-note">{ur?'کوئی نتیجہ نہیں':'No matching animals'}</div>}
     {results.length>0&&results.map(r=><button key={r.id} role="option" onClick={()=>{setShowResults(false);setQuery('');window.location.href=`/dashboard?farm=${r.farmId}&animal=${r.id}`}}><span className="result-tag">{[r.tag,r.name].filter(Boolean).join(' — ')}</span><small>{r.farmName}</small></button>)}
    </div>}
   </div>
   {farms.length>0&&<label className="farm-picker"><Building2 size={15}/><SearchSelect value={selected} onChange={e=>onSelect(e.target.value)} aria-label={ur?'منتخب فارم':'Active farm'}>
    {farms.map(f=><option key={f.id} value={f.id}>{f.name}{f.city?` · ${f.city}`:''}</option>)}
   </SearchSelect></label>}
   <div className="header-actions">
    <button className="language" onClick={toggleDark} aria-label={dark?ur?'ہلکا تھیم':'Light theme':ur?'گہرا تھیم':'Dark theme'} title={dark?'Light':'Dark'}><span className="theme-toggle">{dark?<Sun size={15}/>:<Moon size={15}/>}</span></button>
    <div className="lang-switch" role="group" aria-label={ur?'زبان':'Language'} title={ur?'زبان':'Language'}><button className={ur?'':'on'} onClick={()=>{if(ur)toggle()}} aria-pressed={!ur}>English</button><button className={ur?'on':''} onClick={()=>{if(!ur)toggle()}} aria-pressed={ur}>اردو</button></div>
    <div className="notif-bell">
     <button className="bell-button" onClick={()=>setNotifOpen(o=>!o)} aria-label={ur?'اطلاعات':'Notifications'}>
      <Bell size={18}/>{unread>0&&<span className="bell-badge">{unread>9?'9+':unread}</span>}
     </button>
     {notifOpen&&<div className="notif-panel" role="dialog">
      <div className="notif-head"><strong>{ur?'اطلاعات':'Notifications'}</strong>{unread>0&&<button className="row-action" disabled={notifBusy} onClick={markAll}>{ur?'سب پڑھیں':'Mark all read'}</button>}</div>
      {notifError&&<div className="form-error" role="alert">{notifError}</div>}
      <div className="notif-list">
       {loadingNotifs&&<div className="search-note">{ur?'لوڈ ہو رہا ہے…':'Loading…'}</div>}
       {!loadingNotifs&&notifs.length===0&&<div className="search-note">{ur?'کوئی اطلاع نہیں':'No notifications yet'}</div>}
       {notifs.map(n=><button key={n.id} disabled={notifBusy} className={`notif-item ${n.is_read?'':'unread'}`} onClick={()=>openNotification(n)}><span className="notif-title">{n.title}</span>{n.body&&<span className="notif-body">{n.body}</span>}<small>{new Date(n.created_at).toLocaleString()}</small></button>)}
      </div>
     </div>}
    </div>
    <div className="user-menu">
     <button className="user-button" aria-label={ur?'صارف مینو':'User menu'} aria-expanded={userMenu} onClick={()=>setUserMenu(o=>!o)}><span className="name">{user?.name||''}</span><ChevronDown size={12}/></button>
     {userMenu&&<div className="user-menu-pop">
      <button onClick={()=>{setUserMenu(false);onProfile()}}><UserRound size={15}/>{ur?'پروفائل اور پاس ورڈ':'Profile & password'}</button>
      {settingsAllowed&&<button onClick={()=>{setUserMenu(false);onSettings()}}><Building2 size={15}/>{ur?'ترتیبات':'Settings'}</button>}
      <button disabled={busy} onClick={()=>{setUserMenu(false);onLogout()}}><LogOut size={15}/>{ur?'سائن آؤٹ':'Sign out'}</button>
     </div>}
    </div>
   </div>
  </div>
 </header>;
}
