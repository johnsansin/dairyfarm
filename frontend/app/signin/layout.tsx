import type {Metadata} from 'next';
import {privateMetadata} from '../seo';
export const metadata:Metadata={...privateMetadata,title:'Sign in'};
export default function Layout({children}:{children:React.ReactNode}){return children}
