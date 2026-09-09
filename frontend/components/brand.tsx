import Link from 'next/link';
import { Sprout } from 'lucide-react';
export default function Brand({href='/',onClick}:{href?:string;onClick?:()=>void}){return <Link className="brand" href={href} onClick={onClick} aria-label="DairyMonitor dashboard"><span className="brand-mark"><Sprout size={25}/></span><span>Dairy<span className="brand-light">Monitor</span><small>ONLINE</small></span></Link>}
