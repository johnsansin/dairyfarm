'use client';
import {ChevronLeft,ChevronRight,GripVertical,Pencil} from 'lucide-react';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {api} from './api';
import SearchSelect from './search-select-v2';

type EventRow={id:string;date:string;title:string;type:string;priority?:string;status?:string};
type View='today'|'week'|'month'|'year';
const iso=(d:Date)=>d.toLocaleDateString('en-CA');

export default function FarmCalendar({base,ur}:{base:string;ur:boolean}){
 const [anchor,setAnchor]=useState(new Date());
 const [view,setView]=useState<View>('month');
 const [events,setEvents]=useState<EventRow[]>([]);
 const [editing,setEditing]=useState<EventRow|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [canEdit,setCanEdit]=useState(false);
 const range=useMemo(()=>{
  if(view==='today')return [anchor,anchor];
  if(view==='week'){const a=new Date(anchor);a.setDate(a.getDate()-a.getDay());const b=new Date(a);b.setDate(a.getDate()+6);return[a,b]}
  if(view==='year')return[new Date(anchor.getFullYear(),0,1),new Date(anchor.getFullYear(),11,31)];
  return[new Date(anchor.getFullYear(),anchor.getMonth(),1),new Date(anchor.getFullYear(),anchor.getMonth()+1,0)];
 },[anchor,view]);
 const load=useCallback(()=>api(`${base}/calendar?from=${iso(range[0])}&to=${iso(range[1])}`).then(setEvents).catch(e=>setError(e.message)),[base,range]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{api(base+'/access').then(a=>setCanEdit(a.role==='OWNER'||a.permissions?.tasks==='write')).catch(()=>setCanEdit(false))},[base]);
 const days=useMemo(()=>{const out:(Date|null)[]=[];if(view==='month')for(let i=0;i<range[0].getDay();i++)out.push(null);for(let d=new Date(range[0]);d<=range[1];d.setDate(d.getDate()+1))out.push(new Date(d));return out},[range,view]);
 function move(delta:number){const d=new Date(anchor);view==='year'?d.setFullYear(d.getFullYear()+delta):view==='month'?d.setMonth(d.getMonth()+delta):d.setDate(d.getDate()+delta*(view==='week'?7:1));setAnchor(d)}
 async function update(task:EventRow,date:string,extra:Partial<EventRow>={}){if(!canEdit||task.type!=='Task')return;setBusy(true);setError('');try{await api(base+'/calendar/tasks/'+task.id,{method:'PATCH',body:JSON.stringify({date,title:extra.title,priority:extra.priority,status:extra.status})});setEditing(null);await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const label=view==='today'?anchor.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'}):view==='week'?`${range[0].toLocaleDateString()} – ${range[1].toLocaleDateString()}`:view==='year'?String(anchor.getFullYear()):anchor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const eventCard=(e:EventRow)=><button key={e.type+e.id} type="button" draggable={canEdit&&e.type==='Task'} onDragStart={x=>x.dataTransfer.setData('text/task-id',e.id)} onClick={()=>e.type==='Task'&&canEdit&&setEditing(e)} className={`calendar-event ${e.type.toLowerCase()}`}>{e.type==='Task'&&canEdit?<GripVertical size={13}/>:null}<span>{e.title}</span><small>{e.type}</small></button>;
 return <div className="app-view">
  <div className="module-heading calendar-heading"><div><h2>{ur?'فارم کیلنڈر':'Farm operations calendar'}</h2><p>{ur?'ٹاسک کھینچ کر نئی تاریخ پر چھوڑیں، یا موبائل پر ٹاسک کو چھو کر ترمیم کریں۔':'Drag tasks to a new date, or tap a task to edit it on mobile.'}</p></div><div className="calendar-controls"><div className="calendar-views">{(['today','week','month','year'] as View[]).map(v=><button type="button" key={v} className={view===v?'button small':'secondary-button'} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div><div className="calendar-nav"><button type="button" className="secondary-button" onClick={()=>move(-1)} aria-label="Previous period"><ChevronLeft/></button><strong>{label}</strong><button type="button" className="secondary-button" onClick={()=>move(1)} aria-label="Next period"><ChevronRight/></button></div></div></div>
  {error&&<div className="form-error">{error}</div>}
  {view==='year'?<div className="year-grid">{Array.from({length:12},(_,m)=>{const monthEvents=events.filter(e=>new Date(e.date).getMonth()===m);return <article className="year-month" key={m}><button type="button" className="year-month-open" onClick={()=>{setAnchor(new Date(anchor.getFullYear(),m,1));setView('month')}}><strong>{new Date(anchor.getFullYear(),m,1).toLocaleDateString(undefined,{month:'long'})}</strong><span>{monthEvents.length} planned item{monthEvents.length===1?'':'s'}</span></button><div className="year-month-events">{monthEvents.slice(0,3).map(eventCard)}</div></article>})}</div>:<div className={`calendar-grid ${view}-view`}>{view!=='today'&&'Sun Mon Tue Wed Thu Fri Sat'.split(' ').map(d=><div className="calendar-weekday" key={d}>{d}</div>)}{days.map((d,i)=><div className={`calendar-day${d&&iso(d)===iso(new Date())?' today':''}`} key={i} onDragOver={e=>{if(canEdit)e.preventDefault()}} onDrop={e=>{const id=e.dataTransfer.getData('text/task-id'),task=events.find(x=>x.id===id&&x.type==='Task');if(d&&task)void update(task,iso(d))}}>{d&&<><span>{view==='today'?d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}):d.getDate()}</span>{events.filter(e=>e.date.slice(0,10)===iso(d)).map(eventCard)}</>}</div>)}</div>}
  {editing&&<div className="modal-backdrop"><form className="record-modal" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void update(editing,String(f.get('date')),{title:String(f.get('title')),priority:String(f.get('priority')),status:String(f.get('status'))})}}><div className="modal-heading"><h2><Pencil size={17}/> Edit task</h2><button type="button" className="row-action" onClick={()=>setEditing(null)}>Close</button></div><label className="form-field">Task<input name="title" defaultValue={editing.title} required/></label><label className="form-field">Date<input name="date" type="date" defaultValue={editing.date.slice(0,10)} required/></label><label className="form-field">Priority<SearchSelect name="priority" defaultValue={editing.priority||'Normal'}><option>Normal</option><option>High</option><option>Urgent</option></SearchSelect></label><label className="form-field">Status<SearchSelect name="status" defaultValue={editing.status||'Assigned'}><option>Assigned</option><option>In progress</option><option>Completed</option><option>Verified</option></SearchSelect></label><div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setEditing(null)}>Cancel</button><button className="button" disabled={busy}>Save task</button></div></form></div>}
 </div>;
}

