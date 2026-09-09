import type {Metadata} from 'next';

export function publicMetadata(title:string,description:string,path:string):Metadata{
 return {
  title,description,alternates:{canonical:path},
  openGraph:{type:'website',locale:'en_PK',alternateLocale:['ur_PK'],url:path,siteName:'DairyMonitor',title,description},
  twitter:{card:'summary_large_image',title,description},
 };
}

export const privateMetadata:Metadata={robots:{index:false,follow:false,noarchive:true,nosnippet:true},alternates:{canonical:null}};
