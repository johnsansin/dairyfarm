import Link from 'next/link';
import { Sprout } from 'lucide-react';
export default function Brand({href='/'}:{href?:string}){return <Link className="brand" href={href} aria-label="DairyMonitor home"><span className="brand-mark"><Sprout size={25}/></span><span>Dairy<span className="brand-light">Monitor</span><small>ONLINE</small></span></Link>}
