import {ImageResponse} from 'next/og';

export const alt='DairyMonitor — clearer records, healthier herds, stronger dairy farms';
export const size={width:1200,height:630};
export const contentType='image/png';

export default function OpenGraphImage(){
 return new ImageResponse(
  <div style={{width:'100%',height:'100%',display:'flex',position:'relative',overflow:'hidden',background:'#f3efe2',color:'#173e2b',fontFamily:'sans-serif',padding:'72px'}}>
   <div style={{position:'absolute',right:-120,top:-170,width:620,height:620,borderRadius:999,background:'#bdd2b6'}}/>
   <div style={{position:'absolute',right:100,bottom:-250,width:620,height:620,borderRadius:999,background:'#5f8b69'}}/>
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',zIndex:1,maxWidth:800}}>
    <div style={{display:'flex',alignItems:'center',fontSize:34,fontWeight:700,letterSpacing:-1}}><span style={{display:'flex',width:42,height:42,borderRadius:13,background:'#36744d',marginRight:16}}/>DairyMonitor</div>
    <div style={{display:'flex',flexDirection:'column'}}><span style={{fontSize:22,textTransform:'uppercase',letterSpacing:4,color:'#527361',marginBottom:20}}>The connected dairy farm</span><span style={{fontSize:68,lineHeight:1.05,fontWeight:750,letterSpacing:-3}}>Clearer records.<br/>Healthier herds.<br/>A stronger farm.</span></div>
    <div style={{fontSize:24,color:'#527361'}}>Herd · Milk · Health · Feed · Finances · Reports</div>
   </div>
  </div>,size
 );
}
