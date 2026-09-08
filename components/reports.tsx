'use client';
import {useEffect,useState} from 'react';
import {api} from './api';
import {modules} from '../shared/modules';
import SearchSelect from './search-select';
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export default function Reports({base,ur}:{base:string;ur:boolean}){
 const [module,setModule]=useState('animals'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[search,setSearch]=useState(''),[animal,setAnimal]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1);
 const [data,setData]=useState<any>(null),[animals,setAnimals]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const m=modules.find(x=>x.key===module)!;const state=m.fields.find(f=>['status','disposition','category'].includes(f.key));
 const query=new URLSearchParams({page:String(page),...(from?{from}:{}),...(to?{to}:{}),...(search?{search}:{}),...(animal?{animal_id:animal}:{}),...(status?{status}: {})}).toString();
 useEffect(()=>{api(base+'/options/animals').then(setAnimals).catch(()=>{})},[base]);
 useEffect(()=>{let alive=true;setBusy(true);setError('');api(base+'/reports/records/'+module+'?'+query).then(d=>{if(alive)setData(d)}).catch(e=>{if(alive){setError(e.message);setData(null)}}).finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[base,module,query]);
 function cell(r:any,key:string){if(key==='tag')return [r.tag,r.name].filter(Boolean).join(' — ');const v=r[key];return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)?v.slice(0,10):v??'—'}
 async function pdf(){
 const win=window.open('','_blank');if(!win){setError('Allow the print window to generate a PDF.');return}
 win.document.title='Preparing report';win.document.body.textContent='Preparing report…';
 try{
 let rows:any[]=[];for(let p=1;p<=Math.ceil(Math.min(data.total,10000)/50);p++){const q=new URLSearchParams(query);q.set('page',String(p));rows.push(...(await api(base+'/reports/records/'+module+'?'+q)).rows)}
 win.document.documentElement.dir=ur?'rtl':'ltr';
 win.document.head.innerHTML='<title>'+escape(m.en)+' report</title><style>body{margin:24px}table{border-collapse:collapse;width:100%}td,th{padding:6px;border:1px solid #ccc;text-align:start;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}@page{size:landscape;margin:12mm}</style>';
 win.document.body.style.fontFamily=getComputedStyle(document.body).fontFamily;
 win.document.body.innerHTML='<h1>'+escape(ur?m.ur:m.en)+'</h1><p>'+escape('Dates: '+(from||'All')+' — '+(to||'All')+' | Search: '+(search||'All')+' | Status: '+(status||'All')+' | Records: '+rows.length)+'</p><table><thead><tr>'+data.columns.map((c:any)=>'<th>'+escape(c.label)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+data.columns.map((c:any)=>'<td>'+escape(cell(r,c.key))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 win.focus();win.print();
 }catch(e){win.close();setError((e as Error).message)}
 }
 return <section><h2>{ur?'رپورٹ سینٹر':'Report center'}</h2><p>{ur?'فلٹر منتخب کریں، رپورٹ دیکھیں اور برآمد کریں۔':'View filtered records below, then export the same selection to CSV or Print / PDF (up to 10,000 records).'}</p>
 <div className="workspace-panel fields-grid"><label className="form-field">Report<SearchSelect value={module} onChange={e=>{setModule(e.target.value);setPage(1);setAnimal('');setStatus('')}}>{modules.map(m=><option key={m.key} value={m.key}>{ur?m.ur:m.en}</option>)}</SearchSelect></label><label className="form-field">Search records<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></label><label className="form-field">From date<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1)}}/></label><label className="form-field">To date<input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1)}}/></label>
 {(module==='animals'||m.fields.some(f=>f.key==='animal_id'))&&<label className="form-field">Animal<SearchSelect value={animal} onChange={e=>{setAnimal(e.target.value);setPage(1)}}><option value="">All animals</option>{animals.map(a=><option key={a.id} value={a.id}>{[a.tag,a.name].filter(Boolean).join(' — ')}</option>)}</SearchSelect></label>}
 {state&&<label className="form-field">{state.en}<SearchSelect value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">All</option>{state.options?.map(v=><option key={v}>{v}</option>)}</SearchSelect></label>}</div>
 {error&&<p className="form-error" role="alert">{error}</p>}{busy&&<p role="status">Loading report…</p>}
 {data&&!error&&<><div className="record-toolbar"><span>{data.total} records · Date field: {data.dateField}</span><div className="record-actions"><a className="secondary-button" href={base+'/reports/records/'+module+'?'+query+'&format=csv'}>Export CSV</a><button className="secondary-button" disabled={busy} onClick={pdf}>Print / PDF</button></div></div><div className="records-table-wrap"><table className="records-table"><thead><tr>{data.columns.map((c:any)=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{data.rows.map((r:any)=><tr key={r.id}>{data.columns.map((c:any)=><td key={c.key}>{String(cell(r,c.key))}</td>)}</tr>)}</tbody></table>{!data.rows.length&&<p>No records match these filters.</p>}</div><div className="pagination"><button className="secondary-button" disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{page} / {Math.max(1,Math.ceil(data.total/50))}</span><button className="secondary-button" disabled={page*50>=data.total||busy} onClick={()=>setPage(p=>p+1)}>Next</button></div></>}
 </section>
}
