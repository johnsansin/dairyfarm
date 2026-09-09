import {ImageResponse} from 'next/og';
export const size={width:64,height:64};
export const contentType='image/png';
export default function Icon(){return new ImageResponse(<div style={{width:"64px",height:"64px",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#2E6B4E,#4C9871)",borderRadius:"19px 19px 19px 6px"}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h8"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.2 3.7-2 .4-3.5.4-4.7-.3-1.2-.6-2-1.9-2.6-3.8 2.3-.4 3.9-.3 5.1.4Z"/><path d="M14.1 6a7 7 0 0 0-1.4 5.4c1.8 0 3.2-.5 4.2-1.6 1-1 1.6-2.6 1.8-4.6-2-.2-3.5.1-4.6.8Z"/></svg></div>,size)}
