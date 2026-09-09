'use client';
import {useEffect,useState} from 'react';
import {Activity,ClipboardList,HeartPulse,Leaf,Milk,Plus,Rss,Syringe,Users} from 'lucide-react';
import {api} from './api';
import MilkProductionGraph from './milk-production-graph';

export default function OverviewRedesign({base,ur,select,name}:{base:string;ur:boolean;select:(v:string)=>void;name:string}){
 const [data,setData]=useState<any>(null);const [error,setError]=useState('');
 useEffect(()=>{api(base+'/summary').then(setData).catch(e=>setError(e.message))},[base]);
 if(error)return <div role="alert" className="form-error">{error}</div>;
 if(!data)return <div className="overview-loader" role="status"><span className="loader-ring"/>{ur?'جائزہ لوڈ ہو رہا ہے…':'Loading farm overview…'}</div>;
 const today=Number(data.milk.today||0),yesterday=Number(data.milk.yesterday||0);const delta=yesterday?((today-yesterday)/yesterday)*100:null;
 const trend=(data.trend||[]);const values=trend.map((r:any)=>Number(r.quantity));const max=Math.max(...values,1),min=Math.min(...values,0),range=Math.max(max-min,1);
 const point=(value:number,index:number)=>({x:trend.length===1?300:10+index*580/(trend.length-1),y:170-(value-min)/range*145});
 const points=values.map((value:number,index:number)=>{const p=point(value,index);return `${p.x},${p.y}`}).join(' ');const area=points?`10,180 ${points} ${trend.length===1?'300':590},180`:'';const peakIndex=values.indexOf(max);
 const recent=values.slice(-7).reduce((a:number,b:number)=>a+b,0),prior=values.slice(-14,-7).reduce((a:number,b:number)=>a+b,0);const weekly=prior?((recent-prior)/prior)*100:delta;
 const hour=new Date().getHours();const greeting=ur?(hour<12?'صبح بخیر':hour<17?'دوپہر بخیر':'شام بخیر'):(hour<12?'Good morning':hour<17?'Good afternoon':'Good evening');
 const message=delta==null?(ur?'آج کا دودھ ریکارڈ کریں اور پیداوار دیکھیں۔':'Record today’s milk to start tracking yield.'):(delta>=0?(ur?`${name} کی پیداوار کل سے ${Math.abs(delta).toFixed(1)}% زیادہ ہے۔`:`${name} is tracking ${Math.abs(delta).toFixed(1)}% above yesterday’s yield.`):(ur?`آج کی پیداوار کل سے ${Math.abs(delta).toFixed(1)}% کم ہے۔`:`Today’s yield is ${Math.abs(delta).toFixed(1)}% below yesterday.`));
 const todayDate=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Karachi'});
 return <div className="ov-page ov-redesign">
  <section className="ov-banner"><div className="ov-banner-text"><div className="k"><Activity size={15}/>{greeting}</div><div className="v">{message}</div></div><div className="banner-trend"><span className="trend-ring">{weekly==null?'—':`${weekly>=0?'+':''}${weekly.toFixed(0)}%`}</span><span><small>{ur?'۷ دن کا رجحان':'7-day trend'}</small><strong>{weekly==null?(ur?'ریکارڈ درکار':'More data needed'):`${weekly>=0?'+':''}${weekly.toFixed(1)}% ${ur?'اوسط پیداوار':'average yield'}`}</strong></span></div></section>
  <header className="ov-page-head"><div><div className="ov-title">{ur?'فارم کا جائزہ':'Farm overview'}</div><div className="ov-sub">{ur?'آپ کے محفوظ کردہ ریکارڈ سے تازہ صورتحال۔ تاریخیں پاکستان کے وقت کے مطابق ہیں۔':'Live figures from your saved farm records. Dates use Pakistan time.'}</div></div><button className="ov-btn" onClick={()=>select('milk')}><Plus size={16}/>{ur?'دودھ درج کریں':'Record milk'}</button></header>
  <div className="ov-kpis">{[
   [ur?'فعال جانور':'Active animals',data.herd.total,'',Users,ur?'موجودہ ریوڑ':'Current herd',''],
   [ur?'دودھ دینے والے':'Lactating animals',data.herd.lactating,'',Milk,ur?'فعال پیداوار':'In production',''],
   [ur?'آج کا دودھ':'Today’s milk',today,'L',Milk,delta==null?(ur?'گزشتہ ڈیٹا نہیں':'No prior data'):`${delta>=0?'↑':'↓'} ${Math.abs(delta).toFixed(1)}% ${ur?'کل کے مقابلے':'vs yesterday'}`,'amber'],
   [ur?'کل کا دودھ':'Yesterday’s milk',yesterday,'L',Activity,ur?'گزشتہ مکمل دن':'Previous full day','']
  ].map(([title,value,unit,Icon,note,tone]:any)=><article className={`ov-kpi ${tone}`} key={title}><div className="ov-kpi-top"><span>{title}</span><span className={`ov-kpi-icon ${tone}`}><Icon size={17}/></span></div><div className="ov-kpi-value">{value}<span className="unit">{unit}</span></div><span className={`ov-delta ${delta!=null&&delta<0&&title===(ur?'آج کا دودھ':'Today’s milk')?'down':''}`}>{note}</span></article>)}</div>
  <div className="ov-grid"><section className="ov-card milk-chart-card"><div className="ov-card-head"><div><div className="ov-card-title">{ur?'دودھ کی پیداوار':'Milk production'}</div><small>{ur?'آخری ۱۰ دن · روزانہ لیٹر':'Last 10 days · litres per day'}</small></div><span className="chart-legend"><i/>{ur?'روزانہ پیداوار':'Daily yield'}</span></div><MilkProductionGraph trend={trend} ur={ur}/></section>
  <section className="ov-card reminders-card"><div className="ov-card-head"><div className="ov-card-title">{ur?'آنے والے کام اور یاد دہانیاں':'Upcoming work & reminders'}</div></div>{data.due.length?data.due.slice(0,5).map((r:any)=>{const overdue=String(r.date).slice(0,10)<=todayDate;const ReminderIcon=r.kind==='Vaccination'?Syringe:r.kind==='Task'?ClipboardList:HeartPulse;return <button type="button" className={`ov-reminder ${overdue?'urgent':''}`} key={`${r.kind}-${r.id}`} onClick={()=>select('calendar')}><span className="reminder-icon"><ReminderIcon size={16}/></span><div><div className="ov-rem-title">{r.title}{r.animal?` · ${r.animal}`:''}</div><div className="ov-rem-date">{String(r.date).slice(0,10)}</div></div><span className="reminder-badge">{overdue?(ur?'فوری':'Due'):(ur?'آنے والا':'Upcoming')}</span></button>}):<div className="ov-empty">{ur?'کوئی یاد دہانی نہیں':'No upcoming reminders'}</div>}</section></div>
  <div className="ov-actions"><button className="ov-qa" onClick={()=>select('animals')}><span><Users/></span>{ur?'جانور':'Animals'}</button><button className="ov-qa purple" onClick={()=>select('health')}><span><HeartPulse/></span>{ur?'صحت اور علاج':'Health & treatments'}</button><button className="ov-qa amber" onClick={()=>select('inventory')}><span><Leaf/></span>{ur?'خوراک اور ذخیرہ':'Feed & inventory'}</button><button className="ov-qa blue" onClick={()=>select('buyers')}><span><Rss/></span>{ur?'دودھ کے خریدار':'Milk buyers'}</button></div>
 </div>
}
