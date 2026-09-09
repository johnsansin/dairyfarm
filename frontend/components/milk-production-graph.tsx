'use client';
import {useMemo,useState} from 'react';
import {AreaChart,BarChart3,Eye,EyeOff,LineChart,Milk,TrendingUp} from 'lucide-react';
type TrendRow={date:string;quantity:string|number};
type Range='day'|'week'|'month'|'year';
type ChartType='area'|'line'|'bar';

export default function MilkProductionGraph({trend,ur}:{trend:TrendRow[];ur:boolean}){
 const [range,setRange]=useState<Range>('week');const [chartType,setChartType]=useState<ChartType>('area');const [showValues,setShowValues]=useState(false);
 const rows=useMemo(()=>{
  const source=trend.map(row=>({date:String(row.date).slice(0,10),quantity:Number(row.quantity)||0}));
  if(range==='day')return source.slice(-10).map(row=>({...row,label:row.date.slice(5)}));
  const groups=new Map<string,{quantity:number,label:string,date:string}>();
  for(const row of source){const d=new Date(`${row.date}T00:00:00Z`);let key=row.date,label=row.date;
   if(range==='week'){const start=new Date(d);start.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));key=start.toISOString().slice(0,10);label=`${ur?'ہفتہ':'W'} ${key.slice(5)}`}
   if(range==='month'){key=row.date.slice(0,7);label=new Intl.DateTimeFormat(ur?'ur-PK':'en',{month:'short'}).format(d)}
   if(range==='year'){key=row.date.slice(0,4);label=key}
   const old=groups.get(key);groups.set(key,{date:key,label,quantity:(old?.quantity||0)+row.quantity});
  }
  return [...groups.values()].slice(range==='week'?-8:range==='month'?-12:-5);
 },[trend,range,ur]);
 if(!trend.length)return <div className="ov-empty"><Milk size={28}/><p>{ur?'چارٹ دیکھنے کے لیے دودھ درج کریں۔':'Record milk to start tracking production.'}</p></div>;
 const values=rows.map(row=>row.quantity),max=Math.max(...values,1),total=values.reduce((sum,value)=>sum+value,0),average=total/Math.max(values.length,1),peak=values.indexOf(Math.max(...values));
 const min=Math.min(...values,0),span=Math.max(max-min,1);const points=rows.map((row,index)=>({x:rows.length===1?300:14+index*552/Math.max(rows.length-1,1),y:174-(row.quantity-min)/span*146,value:row.quantity,label:row.label}));const line=points.map((point,index)=>`${index?'L':'M'}${point.x},${point.y}`).join(' ');const area=line&&`${line} L${points.at(-1)?.x},180 L${points[0]?.x},180 Z`;
 const rangeNames:{key:Range;en:string;ur:string}[]=[{key:'day',en:'Day',ur:'دن'},{key:'week',en:'Week',ur:'ہفتہ'},{key:'month',en:'Month',ur:'مہینہ'},{key:'year',en:'Year',ur:'سال'}];
 return <div className="milk-columns-wrap">
  <div className="milk-chart-tools"><div className="graph-ranges" role="group" aria-label={ur?'چارٹ مدت':'Graph period'}>{rangeNames.map(item=><button type="button" key={item.key} className={range===item.key?'active':''} onClick={()=>setRange(item.key)}>{ur?item.ur:item.en}</button>)}</div><div className="graph-tool-end"><div className="graph-types" role="group" aria-label={ur?'چارٹ کی قسم':'Chart type'}><button type="button" className={chartType==='area'?'active':''} title="Area chart" onClick={()=>setChartType('area')}><AreaChart size={14}/></button><button type="button" className={chartType==='line'?'active':''} title="Line chart" onClick={()=>setChartType('line')}><LineChart size={14}/></button><button type="button" className={chartType==='bar'?'active':''} title="Bar chart" onClick={()=>setChartType('bar')}><BarChart3 size={14}/></button></div><button type="button" className={`values-toggle${showValues?' active':''}`} onClick={()=>setShowValues(value=>!value)}>{showValues?<EyeOff size={14}/>:<Eye size={14}/>} {ur?(showValues?'قدریں چھپائیں':'قدریں دکھائیں'):(showValues?'Hide values':'Show values')}</button></div></div>
  <div className="milk-chart-summary"><span><small>{ur?'منتخب مدت کی کل مقدار':'Period total'}</small><strong>{total.toFixed(1)} L</strong></span><span><small>{ur?'اوسط':'Average'}</small><strong>{average.toFixed(1)} L</strong></span><span className="peak-summary"><TrendingUp size={15}/><span><small>{ur?'بہترین مدت':'Best period'}</small><strong>{max.toFixed(1)} L</strong></span></span></div>
  {chartType==='bar'?<div className={`milk-columns count-${Math.min(rows.length,12)}${showValues?' show-values':''}`} role="img" aria-label={ur?'دودھ پیداوار کا چارٹ':'Milk production chart'}>{rows.map((row,index)=>{const value=values[index],height=Math.max(value?8:2,value/max*100);return <div className={`milk-column${index===peak?' peak':''}`} key={row.date} tabIndex={0} aria-label={`${row.label}: ${value.toFixed(1)} litres`}><span className="column-value">{value.toFixed(1)} L</span><div className="column-track"><i style={{height:`${height}%`}}><b/></i></div><span className="column-date">{row.label}</span></div>})}</div>:<div className={`milk-curve-chart${showValues?' show-values':''}`}><svg viewBox="0 0 580 205" role="img" aria-label={ur?'دودھ پیداوار کا چارٹ':'Milk production chart'}><defs><linearGradient id="milkArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2e6b4e" stopOpacity=".28"/><stop offset="1" stopColor="#2e6b4e" stopOpacity="0"/></linearGradient></defs>{[28,65,102,139,176].map(y=><line key={y} x1="0" x2="580" y1={y} y2={y} className="curve-grid"/>)}{chartType==='area'&&<path d={area} fill="url(#milkArea)"/>}<path d={line} className="curve-line"/>{points.map((point,index)=><g key={rows[index].date} tabIndex={0}><title>{point.label}: {point.value.toFixed(1)} L</title><circle cx={point.x} cy={point.y} r={index===peak?5:3.5} className={index===peak?'curve-point peak':'curve-point'}/><text x={point.x} y={Math.max(14,point.y-10)} className="curve-value">{point.value.toFixed(1)} L</text><text x={point.x} y="200" className="curve-date">{point.label}</text></g>)}</svg></div>}
 </div>
}
