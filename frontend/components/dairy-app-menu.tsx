'use client';
import {useEffect,useMemo,useState} from 'react';
import {Banknote,CalendarDays,ChevronRight,ClipboardList,FileText,Handshake,HeartPulse,LayoutDashboard,Leaf,Milk,Rss,Scale,Settings,ShieldCheck,Star,Stethoscope,Store,Syringe,Users} from 'lucide-react';

export type DairyMenuGroup={label:string;items:{key:string;label:string;icon:string}[]};
const icons:Record<string,React.ElementType>={dash:LayoutDashboard,calendar:CalendarDays,animals:Users,milk:Milk,weights:Scale,health:Stethoscope,vaccinations:Syringe,breeding:HeartPulse,tasks:ClipboardList,staff:Users,buyers:Rss,suppliers:Store,partners:Handshake,inventory:Leaf,acc:Banknote,reports:FileText,settings:ShieldCheck,audit:Settings};

export default function DairyAppMenu({groups,active,onSelect,ur}:{groups:DairyMenuGroup[];active:string;onSelect:(key:string)=>void;ur:boolean}){
 const activeGroup=groups.find(group=>group.items.some(item=>item.key===active))?.label||groups[0]?.label||'';
 const [expanded,setExpanded]=useState(activeGroup);const [favorites,setFavorites]=useState<string[]>(['overview','calendar','tasks','reports']);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('dm-menu-favorites')||'null');if(Array.isArray(saved))setFavorites(saved)}catch{}},[]);
 useEffect(()=>{setExpanded(activeGroup)},[activeGroup]);
 const all=useMemo(()=>groups.flatMap(group=>group.items),[groups]);
 function toggle(key:string){setFavorites(current=>{const next=current.includes(key)?current.filter(item=>item!==key):[...current,key];localStorage.setItem('dm-menu-favorites',JSON.stringify(next));return next})}
 const selectedGroup=groups.find(group=>group.label===expanded)||groups[0];
 const Item=({item,favorite=false}:{item:{key:string;label:string;icon:string};favorite?:boolean})=>{const Icon=icons[item.icon]||ClipboardList;return <div className={`biz-module-wrap${favorite?' favorite':''}`}><button type="button" className={`biz-module${active===item.key?' selected':''}`} onClick={()=>onSelect(item.key)}><span><Icon size={favorite?18:16}/></span><em>{item.label}</em></button><button type="button" className={`biz-star${favorites.includes(item.key)?' saved':''}`} onClick={()=>toggle(item.key)} aria-label={`${favorites.includes(item.key)?'Remove':'Add'} ${item.label} favorite`}><Star size={13} fill={favorites.includes(item.key)?'currentColor':'none'}/></button></div>};
 return <div className="biz-menu">
  <section className="biz-favorites"><header><span>{ur?'پسندیدہ':'Favorites'}</span><small>{ur?'ستارے سے اپنی فہرست بنائیں':'Click a star to personalize'}</small></header><div>{favorites.map(key=>all.find(item=>item.key===key)).filter(Boolean).map(item=><Item key={item!.key} item={item!} favorite/>)}</div></section>
  <div className="biz-menu-body"><nav aria-label={ur?'ایپ گروپس':'Application groups'}><small>{ur?'ایپس':'Apps'}</small>{groups.map(group=><button type="button" className={expanded===group.label?'selected':''} key={group.label} onClick={()=>setExpanded(group.label)}><span>{group.label}</span><ChevronRight size={14}/></button>)}</nav><section className="biz-modules"><h2>{selectedGroup?.label}</h2><p>{ur?'جاری رکھنے کے لیے ماڈیول منتخب کریں':'Select a module to continue'}</p><div>{selectedGroup?.items.map(item=><Item key={item.key} item={item}/>)}</div></section></div>
 </div>
}
