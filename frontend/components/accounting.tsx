'use client';
import SearchSelect from './search-select';
import {useEffect,useState,useCallback} from 'react';
import {Plus,Download,FileText,BookOpenText,ListChecks,BookMinus,Banknote} from 'lucide-react';
import {api} from './api';
type Row=Record<string,string|number|null>;
function label(en:string,urdu:string){return urdu}
function num(v:string|number|null|undefined):number{return Number(v??0)||0}
function fmt(n:number){return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function csv(rows:Row[],keyCols:string[]):string{
 const cell=(v:unknown)=>{const s=String(v??'');return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[keyCols.map(c=>cell(c)).join(','),...rows.map(r=>keyCols.map(c=>cell(r[c])).join(','))].join('\r\n');
}
function download(name:string,content:string,type:string){const b=new Blob([content],{type});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function printHTML(title:string,html:string){const w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px}th{background:#f3f6f4}.num{text-align:right}.totals{font-weight:bold;background:#eef4ef}</style></head><body><h1>${title}</h1>${html}<script>window.print()<\/script></body></html>`);w.document.close();}

export default function Accounting({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [tab,setTab]=useState('report');
 return <div className="app-view">
  <div className="module-heading"><div><h2>{ur?'اکاؤنٹنگ':'Accounting'}</h2><p>{ur?'چارٹ آف اکاؤنٹس، جرنل، لیجر اور مالیاتی رپورٹس۔':'Chart of accounts, journal entries, ledger and financial reports.'}</p></div></div>
  <div className="history-tabs accounting-tabs">
   <button className={tab==='report'?'button small':'secondary-button'} onClick={()=>setTab('report')}><FileText size={15}/>{ur?'مالی رپورٹ':'Financial report'}</button>
   <button className={tab==='coa'?'button small':'secondary-button'} onClick={()=>setTab('coa')}><BookOpenText size={15}/>{ur?'چارٹ آف اکاؤنٹس':'Chart of accounts'}</button>
   <button className={tab==='journal'?'button small':'secondary-button'} onClick={()=>setTab('journal')}><ListChecks size={15}/>{ur?'جرنل':'Journal'}</button>
   <button className={tab==='ledger'?'button small':'secondary-button'} onClick={()=>setTab('ledger')}><BookMinus size={15}/>{ur?'لیجر':'Ledger'}</button>
  </div>
  {tab==='report'&&<ReportView base={base} ur={ur}/>}
  {tab==='coa'&&<CoaView base={base} ur={ur} readOnly={readOnly}/>}
  {tab==='journal'&&<JournalView base={base} ur={ur} readOnly={readOnly}/>}
  {tab==='ledger'&&<LedgerView base={base} ur={ur}/>}
 </div>;
}

function CoaView({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [rows,setRows]=useState<Row[]>([]);const [error,setError]=useState('');const [editing,setEditing]=useState(false);const [form,setForm]=useState<Record<string,string>>({code:'',name:'',account_type:'Asset',category:''});const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{setRows(await api(base+'/coa'));setError('')}catch(e){setError((e as Error).message)}},[base]);
 useEffect(()=>{void load()},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);try{await api(base+'/coa',{method:'POST',body:JSON.stringify(form)});setEditing(false);setForm({code:'',name:'',account_type:'Asset',category:''});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const cols=['code','name','account_type','category','is_active'];
 return <div className="records-table-wrap"><div className="record-toolbar"><span>{rows.length} {ur?'اکاؤنٹس':'accounts'}</span>{!readOnly&&<button className="button small" onClick={()=>setEditing(true)}><Plus size={15}/>{ur?'اکاؤنٹ شامل کریں':'Add account'}</button>}</div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <table className="records-table"><thead><tr><th>{ur?'کوڈ':'Code'}</th><th>{ur?'نام':'Name'}</th><th>{ur?'قسم':'Type'}</th><th>{ur?'زمرہ':'Category'}</th><th>{ur?'حالت':'Status'}</th></tr></thead><tbody>
   {rows.map(r=><tr key={String(r.id)}>{cols.map(c=><td key={c}>{c==='is_active'?(String(r.is_active)==='t'?(ur?'فعال':'Active'):ur?'غیر فعال':'Inactive'):r[c]??'—'}</td>)}</tr>)}
  </tbody></table>
  {editing&&<div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true"><div className="modal-heading"><h2>{ur?'نیا اکاؤنٹ':'Add account'}</h2><button className="row-action" onClick={()=>setEditing(false)} aria-label="Close">✕</button></div><form onSubmit={save}><div className="fields-grid">
   <label className="form-field">{ur?'کوڈ':'Code'} *<input value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))} required maxLength={20} placeholder="e.g. 1000"/></label>
   <label className="form-field">{ur?'نام':'Name'} *<input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required maxLength={120}/></label>
   <label className="form-field">{ur?'قسم':'Type'} *<SearchSelect value={form.account_type} onChange={e=>setForm(p=>({...p,account_type:e.target.value}))}>{[['Asset','Asset'],['Liability','Liability'],['Equity','Equity'],['Income','Income'],['Expense','Expense']].map(([v,en])=><option key={v} value={v}>{ur?en:en}</option>)}</SearchSelect></label>
   <label className="form-field">{ur?'زمرہ':'Category'}<input value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} maxLength={80}/></label>
  </div><div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setEditing(false)}>{ur?'منسوخ':'Cancel'}</button><button className="button" disabled={busy}>{busy?'…':ur?'محفوظ کریں':'Save'}</button></div></form></section></div>}
 </div>;
}

function JournalView({base,ur,readOnly}:{base:string;ur:boolean;readOnly:boolean}){
 const [rows,setRows]=useState<Row[]>([]);const [accounts,setAccounts]=useState<Row[]>([]);const [error,setError]=useState('');const [adding,setAdding]=useState(false);const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({account_id:'',entry_date:new Date().toLocaleDateString('en-CA'),entry_type:'General',description:'',debit:'',credit:'',reference:''});
 const load=useCallback(async()=>{try{const [j,a]=await Promise.all([api(base+'/journal'),api(base+'/coa')]);setRows(j);setAccounts(a);setError('')}catch(e){setError((e as Error).message)}},[base]);
 useEffect(()=>{void load()},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);try{await api(base+'/journal',{method:'POST',body:JSON.stringify({...form,debit:Number(form.debit)||0,credit:Number(form.credit)||0})});setAdding(false);setForm({account_id:'',entry_date:new Date().toLocaleDateString('en-CA'),entry_type:'General',description:'',debit:'',credit:'',reference:''});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const cols=['entry_date','reference','account_code','account_name','entry_type','description','debit','credit'];
 return <div className="records-table-wrap"><div className="record-toolbar"><span>{rows.length} {ur?'اندازے':'entries'}{!readOnly&&<><button className="secondary-button" onClick={()=>download('journal.csv',csv(rows,cols),'text/csv')}><Download size={14}/> CSV</button><button className="button small" onClick={()=>setAdding(true)}><Plus size={15}/> {ur?'اندراج':'Entry'}</button></>}</span></div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <table className="records-table"><thead><tr><th>{ur?'تاریخ':'Date'}</th><th>{ur?'حوالہ':'Ref'}</th><th>{ur?'کوڈ':'Code'}</th><th>{ur?'اکاؤنٹ':'Account'}</th><th>{ur?'قسم':'Type'}</th><th>{ur?'تفصیل':'Description'}</th><th className="num">{ur?'ڈیبٹ':'Debit'}</th><th className="num">{ur?'کریڈٹ':'Credit'}</th></tr></thead><tbody>
   {rows.map(r=><tr key={String(r.id)}>{cols.map(c=><td key={c} className={c==='debit'||c==='credit'?'num':''}>{r[c]??'—'}</td>)}</tr>)}
  </tbody></table>
  {adding&&<div className="modal-backdrop"><section className="record-modal" role="dialog" aria-modal="true"><div className="modal-heading"><h2>{ur?'نیا جرنل اندراج':'New journal entry'}</h2><button className="row-action" onClick={()=>setAdding(false)} aria-label="Close">✕</button></div><form onSubmit={save}><div className="fields-grid">
   <label className="form-field">{ur?'اکاؤنٹ':'Account'} *<SearchSelect value={form.account_id} onChange={e=>setForm(p=>({...p,account_id:e.target.value}))} required><option value="">—</option>{accounts.map(a=><option key={String(a.id)} value={String(a.id)}>{a.code} — {ur?String(a.name):String(a.name)}</option>)}</SearchSelect></label>
   <label className="form-field">{ur?'تاریخ':'Date'} *<input type="date" value={form.entry_date} onChange={e=>setForm(p=>({...p,entry_date:e.target.value}))} required/></label>
   <label className="form-field">{ur?'اندراج کی قسم':'Entry type'} *<SearchSelect value={form.entry_type} onChange={e=>setForm(p=>({...p,entry_type:e.target.value}))}>{['General','MilkSale','Expense','Payroll','Distribution','Transfer'].map(v=><option key={v}>{v}</option>)}</SearchSelect></label>
   <label className="form-field">{ur?'حوالہ':'Reference'}<input value={form.reference} onChange={e=>setForm(p=>({...p,reference:e.target.value}))} maxLength={60}/></label>
   <label className="form-field wide">{ur?'تفصیل':'Description'}<input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} maxLength={300}/></label>
   <label className="form-field">{ur?'ڈیبٹ':'Debit'}<input type="number" min="0" step="0.01" value={form.debit} onChange={e=>setForm(p=>({...p,debit:e.target.value}))}/></label>
   <label className="form-field">{ur?'کریڈٹ':'Credit'}<input type="number" min="0" step="0.01" value={form.credit} onChange={e=>setForm(p=>({...p,credit:e.target.value}))}/></label>
  </div><div className="modal-footer"><button type="button" className="secondary-button" onClick={()=>setAdding(false)}>{ur?'منسوخ':'Cancel'}</button><button className="button" disabled={busy}>{busy?'…':ur?'محفوظ کریں':'Save'}</button></div></form></section></div>}
 </div>;
}

function LedgerView({base,ur}:{base:string;ur:boolean}){
 const [rows,setRows]=useState<Row[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{api(base+'/ledger').then(setRows).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[base]);
 const cols=['code','name','account_type','total_debit','total_credit','balance'];
 if(error)return <div className="form-error" role="alert">{error}</div>;
 return <div className="records-table-wrap"><div className="record-toolbar"><span>{rows.length} {ur?'اکاؤنٹس':'accounts'}</span><button className="secondary-button" onClick={()=>download('ledger.csv',csv(rows,cols),'text/csv')}><Download size={14}/> CSV</button></div>
  {loading?<div className="table-empty" role="status">{ur?'لوڈ ہو رہا ہے…':'Loading…'}</div>:<table className="records-table"><thead><tr><th>{ur?'کوڈ':'Code'}</th><th>{ur?'اکاؤنٹ':'Account'}</th><th>{ur?'قسم':'Type'}</th><th className="num">{ur?'کل ڈیبٹ':'Total debit'}</th><th className="num">{ur?'کل کریڈٹ':'Total credit'}</th><th className="num">{ur?'توازن':'Balance'}</th></tr></thead><tbody>
   {rows.map(r=><tr key={String(r.id)}>{cols.map(c=><td key={c} className={c==='total_debit'||c==='total_credit'||c==='balance'?'num':''}>{r[c]??'—'}</td>)}</tr>)}
  </tbody></table>}
 </div>;
}

function ReportView({base,ur}:{base:string;ur:boolean}){
 const [data,setData]=useState<Row|null>(null);const [ledger,setLedger]=useState<Row[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{async function load(){try{const [d,l]=await Promise.all([api(base+'/reports/financial'),api(base+'/ledger')]);setData(d);setLedger(l);}catch(e){setError((e as Error).message)}finally{setLoading(false)}}void load()},[base]);
 if(error)return <div className="form-error" role="alert">{error}</div>;
 if(loading||!data)return <div role="status">{ur?'رپورٹ تیار ہو رہی ہے…':'Preparing report…'}</div>;
 const milk=num(data.milk_sale),exp=num(data.expenses),entries=num(data.total_entries);
 const income=ledger.filter(r=>String(r.account_type)==='Income').reduce((s,r)=>s+num(r.balance),0);
 const expense=ledger.filter(r=>String(r.account_type)==='Expense').reduce((s,r)=>s+num(r.balance),0);
 const assets=ledger.filter(r=>String(r.account_type)==='Asset').reduce((s,r)=>s+num(r.balance),0);
 const liabilities=ledger.filter(r=>String(r.account_type)==='Liability').reduce((s,r)=>s+num(r.balance),0);
 const equity=ledger.filter(r=>String(r.account_type)==='Equity').reduce((s,r)=>s+num(r.balance),0);
 const net=income-expense-equity;
 const body=`<table><tr><th colspan="2">${ur?'مالی رپورٹ':'Financial report'}</th></tr><tr><td>${ur?'دودھ کی فروخت':'Milk sales'}</td><td class="num">${fmt(milk)}</td></tr><tr><td>${ur?'اخراجات':'Expenses'}</td><td class="num">${fmt(exp)}</td></tr><tr><td>${ur?'آمدنی':'Income'}</td><td class="num">${fmt(income)}</td></tr><tr><td>${ur?'اخراجات':'Expenses'}</td><td class="num">${fmt(expense)}</td></tr><tr class="totals"><td>${ur?'خالص منافع':'Net profit'}</td><td class="num">${fmt(income-expense)}</td></tr><tr><td colspan="2"></td></tr><tr><th colspan="2">${ur?'بیلنس شیٹ':'Balance sheet'}</th></tr><tr><td>${ur?'کل اثاثے':'Total assets'}</td><td class="num">${fmt(assets)}</td></tr><tr><td>${ur?'کل ذمہ داریاں':'Total liabilities'}</td><td class="num">${fmt(liabilities)}</td></tr><tr><td>${ur?'کل ایکویٹی':'Total equity'}</td><td class="num">${fmt(equity)}</td></tr><tr class="totals"><td>${ur?'خالص توازن':'Net position'}</td><td class="num">${fmt(assets-liabilities-equity)}</td></tr><tr><td colspan="2"></td></tr><tr><th colspan="2">${ur?'جرنل انٹریاں':'Journal entries'}</th></tr><tr><td>${ur?'کل اندراجات':'Total entries value'}</td><td class="num">${fmt(entries)}</td></tr></table>`;
 return <div className="report-panel"><div className="record-toolbar wrap">
  <button className="secondary-button" onClick={()=>download('financial-report.csv',csv(ledger,['code','name','account_type','total_debit','total_credit','balance']),'text/csv')}><Download size={14}/> CSV</button>
  <button className="button small" onClick={()=>printHTML(ur?'مالی رپورٹ':'Financial Report',body)}><FileText size={15}/> {ur?'پرنٹ / پی ڈی ایف':'Print / PDF'}</button>
 </div>
  <div className="live-stats report-stats">
   <div><span>{ur?'دودھ کی فروخت':'Milk sales'}</span><strong>{fmt(milk)}</strong></div>
   <div><span>{ur?'اخراجات':'Expenses'}</span><strong>{fmt(exp)}</strong></div>
   <div><span>{ur?'آمدنی':'Income'}</span><strong>{fmt(income)}</strong></div>
   <div><span>{ur?'خالص منافع':'Net profit'}</span><strong>{fmt(income-expense)}</strong></div>
  </div>
  <section className="workspace-panel"><h3>{ur?'آمدنی اور اخراجات':'Income & expenses'}</h3>
   <table className="records-table"><thead><tr><th>{ur?'اکاؤنٹ':'Account'}</th><th>{ur?'قسم':'Type'}</th><th className="num">{ur?'توازن':'Balance'}</th></tr></thead><tbody>
    {ledger.filter(r=>['Income','Expense'].includes(String(r.account_type))).map(r=><tr key={String(r.id)}><td>{r.code} — {r.name}</td><td>{r.account_type}</td><td className="num">{fmt(num(r.balance))}</td></tr>)}
   </tbody></table>
  </section>
 </div>;
}
