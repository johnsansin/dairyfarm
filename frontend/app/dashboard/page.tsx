'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Sprout} from 'lucide-react';
import DairyFarms from '../../components/dairy-farms';
import FarmWorkspace from '../../components/farm-workspace';
import Header from '../../components/header';
import FarmCopilot from '../../components/farm-copilot-redesign';
import {useLanguage,useTheme} from '../../components/language';
interface Farm{id:string;name:string;city:string;currency:string;role:string;organization_id?:string|null;organization_name?:string|null;organization_slug?:string|null}
interface Organization{id:string;name:string;slug:string;role?:string;farm_count?:number}
export default function Dashboard(){
 const {ur,t,toggle}=useLanguage();const {dark,toggleDark}=useTheme();const router=useRouter();
 const [query,setQuery]=useState<{farm?:string;tab?:string;animal?:string}>({});const [queryReady,setQueryReady]=useState(false);
 const [user,setUser]=useState<{name:string}|null>(null);const [organizations,setOrganizations]=useState<Organization[]>([]);const [farms,setFarms]=useState<Farm[]>([]);const [selectedOrg,setSelectedOrg]=useState('');const [selected,setSelected]=useState('');const [adding,setAdding]=useState(false);const [addingOrg,setAddingOrg]=useState(false);const [orgName,setOrgName]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [menuOpen,setMenuOpen]=useState(false);const [tab,setTab]=useState<string|undefined>(undefined);
 useEffect(()=>{const sp=new URLSearchParams(window.location.search);setQuery({farm:sp.get('farm')||undefined,tab:sp.get('tab')||undefined,animal:sp.get('animal')||undefined});setQueryReady(true)},[]);
 const qFarm=query.farm;const qTab=query.tab;const qAnimal=query.animal;
 useEffect(()=>{if(!queryReady)return;async function load(){try{const me=await fetch('/api/v1/auth/me');if(me.status===401){router.replace('/signin');return;}if(!me.ok)throw new Error('Service unavailable. Please try again.');setUser(await me.json());const [orgRes,farmRes]=await Promise.all([fetch('/api/v1/organizations'),fetch('/api/v1/farms')]);if(!orgRes.ok||!farmRes.ok)throw new Error('Unable to load tenant data.');const [orgList,farmList]=await Promise.all([orgRes.json(),farmRes.json()]);setOrganizations(orgList);setFarms(farmList);const initialOrg=qFarm?farmList.find((f:Farm)=>f.id===qFarm)?.organization_id||orgList[0]?.id||'':orgList[0]?.id||'';setSelectedOrg(initialOrg);const initialFarm=qFarm&&farmList.some((f:Farm)=>f.id===qFarm)?qFarm:(farmList.find((f:Farm)=>f.organization_id===initialOrg)?.id||farmList[0]?.id||'');setSelected(initialFarm);if(qTab)setTab(qTab);else if(qAnimal)setTab('animals');}catch(e){setError(e instanceof Error?e.message:'Connection failed')}finally{setLoading(false)}}void load()},[router,queryReady,qFarm,qTab,qAnimal]);
 useEffect(()=>{if(!selectedOrg||!farms.length)return;const current=farms.find(f=>f.id===selected);if(current?.organization_id===selectedOrg)return;const next=farms.find(f=>f.organization_id===selectedOrg);if(next)setSelected(next.id)},[selectedOrg,farms,selected]);
  const base=useCallback((farmId:string)=>`/api/v1/farms/${farmId}`,[ ]);
 async function logout(){setBusy(true);try{const r=await fetch('/api/v1/auth/logout',{method:'POST'});if(!r.ok)throw new Error();router.replace('/signin')}catch{setError(t('Unable to sign out. Please try again.','سائن آؤٹ نہیں ہو سکا۔ دوبارہ کوشش کریں۔'))}finally{setBusy(false)}}
 const farm=farms.find(f=>f.id===selected);
 const openDashboard=useCallback(()=>{setTab('overview');setMenuOpen(false);router.replace(`/dashboard${selected?`?farm=${selected}`:''}`)},[router,selected]);
 const management=<DairyFarms farms={farms} selected={selected} ur={ur} onSelect={id=>{setSelected(id);setSelectedOrg(farms.find(f=>f.id===id)?.organization_id||'')}} onSaved={row=>{setFarms(prev=>prev.some(f=>f.id===row.id)?prev.map(f=>f.id===row.id?{...f,...row}:f):[...prev,row]);if(!farms.length){setSelected(row.id);setSelectedOrg(row.organization_id||'')}}}/>;
 if(loading)return <div className="app-loader" role="status"><span className="loader-logo"><Sprout size={38}/></span><span className="loader-ring"/><strong>DairyMonitor</strong><small>{t('Opening your workspace…','آپ کا ورک اسپیس کھل رہا ہے…')}</small></div>;
 return <div className={`dashboard-shell${farms.length?' has-farm':''}${menuOpen?' nav-open':''}`}>
  <Header ur={ur} toggle={toggle} dark={dark} toggleDark={toggleDark} user={user} farms={farms} selected={selected} onSelect={id=>{setSelected(id);setSelectedOrg(farms.find(f=>f.id===id)?.organization_id||'')}} base={base} busy={busy} onLogout={()=>void logout()} onProfile={()=>router.push('/account')} onSettings={()=>setTab('settings')} onDashboard={openDashboard} menuOpen={menuOpen} onMenu={()=>setMenuOpen(o=>!o)}/>
  {selected&&<FarmCopilot base={base(selected)} ur={ur}/>} 
  <div className="workspace-main">
   {error&&<div className="form-error" role="alert">{error}</div>}
   {user&&!farms.length&&management}
   {user&&farms.length>0&&<FarmWorkspace management={management} key={selected} farm={{id:selected,name:farm?.name||'',role:farm?.role||'OWNER',currency:farm?.currency||'PKR'}} ur={ur} requestedTab={tab} onTabUsed={()=>setTab(undefined)} onDashboard={openDashboard} focusAnimalId={qAnimal||undefined} menuOpen={menuOpen} onMenu={()=>setMenuOpen(o=>!o)}/>}
   </div>
   <footer className="app-footer"><span>DairyMonitor <strong>ONLINE</strong></span><span>© {new Date().getFullYear()} · {t('Made for dairy farms','ڈیری فارموں کے لیے')}</span></footer>
  </div>;
}
