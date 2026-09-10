import type {Metadata} from 'next';
import {privateMetadata} from '../seo';
export const metadata:Metadata={...privateMetadata,title:'Create your account'};
export default function Layout({children}:{children:React.ReactNode}){return children}
