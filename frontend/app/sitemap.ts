import type {MetadataRoute} from 'next';
const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://dairymonitor.online';
export default function sitemap():MetadataRoute.Sitemap{
 const pages=[{path:'',priority:1,changeFrequency:'weekly' as const},{path:'/features',priority:.9,changeFrequency:'monthly' as const},{path:'/benefits',priority:.8,changeFrequency:'monthly' as const},{path:'/pricing',priority:.8,changeFrequency:'monthly' as const},{path:'/blog',priority:.7,changeFrequency:'weekly' as const},{path:'/contact',priority:.6,changeFrequency:'yearly' as const},{path:'/privacy',priority:.2,changeFrequency:'yearly' as const},{path:'/cookies',priority:.2,changeFrequency:'yearly' as const},{path:'/terms',priority:.2,changeFrequency:'yearly' as const}];
 return pages.map(page=>({url:`${siteUrl}${page.path}`,lastModified:new Date(),changeFrequency:page.changeFrequency,priority:page.priority}));
}
