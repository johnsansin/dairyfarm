'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,UserRound} from 'lucide-react';

export default function AccountNavigation({ur}:{ur:boolean}) {
 const [user,setUser]=useState<{name:string}|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  async function refresh(){
   try {
    const response=await fetch('/api/v1/auth/me',{cache:'no-store',signal:controller.signal});
    if(response.ok){setUser(await response.json());}
    else if(response.status===401){setUser(null);}
   } catch { /* Keep existing account navigation during a temporary connection failure. */ }
   finally {if(!controller.signal.aborted)setLoading(false);}
  }
  void refresh();
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',visible);
  return ()=>{controller.abort();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[]);
 if(loading)return <span className="account-loading" role="status" aria-label={ur?'اکاؤنٹ چیک ہو رہا ہے':'Checking account'}/>;
 if(user)return <Link className="account-name" href="/dashboard" title={user.name}><UserRound size={17}/><span>{user.name}</span></Link>;
 return <>
  <Link className="button small signin-link" href="/signin">{ur?'سائن ان':'Sign in'}</Link>
  <Link className="button small" href="/register">{ur?'شروع کریں':'Get started'}<ArrowUpRight size={15}/></Link>
 </>;
}
