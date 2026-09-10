import type { Metadata } from 'next';
import './globals.css';
import './redesign.css';
import './dashboard-theme.css';
import './drawer-navigation.css';
import './milk-chart-3d.css';
import './calendar-redesign.css';
import './chart-and-field-fixes.css';
import './milk-columns.css';
import './calendar-priorities.css';
import './task-followups.css';
import './dashboard-polish.css';
import './dashboard-reference.css';
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://dairymonitor.online');
export const metadata: Metadata = {
 metadataBase: siteUrl,
 title: {default:'DairyMonitor — Dairy Farm Management Software',template:'%s | DairyMonitor'},
 description:'Manage dairy cattle and buffalo records, milk production, health, feed, inventory, staff, expenses, and farm profitability in English and Urdu.',
 applicationName:'DairyMonitor',
 keywords:['dairy farm management software','dairy herd management','milk production records','cattle management software','buffalo farm management','dairy farm Pakistan','livestock management software'],
 authors:[{name:'DairyMonitor',url:siteUrl}],creator:'DairyMonitor',publisher:'DairyMonitor',
 alternates:{canonical:'/'},
 openGraph:{type:'website',locale:'en_PK',alternateLocale:['ur_PK'],url:'/',siteName:'DairyMonitor',title:'DairyMonitor — Dairy Farm Management Software',description:'A connected workspace for healthier herds, accurate milk records, controlled costs, and stronger dairy farms.'},
 twitter:{card:'summary_large_image',title:'DairyMonitor — Dairy Farm Management Software',description:'Manage your herd, milk, health, feed, inventory, and farm finances in one connected workspace.'},
 category:'technology',
};
const structuredData={'@context':'https://schema.org','@graph':[
 {'@type':'Organization','@id':`${siteUrl}#organization`,name:'DairyMonitor',url:siteUrl.toString(),email:'hello@dairymonitor.online',address:{'@type':'PostalAddress',addressLocality:'Lahore',addressCountry:'PK'}},
 {'@type':'WebSite','@id':`${siteUrl}#website`,url:siteUrl.toString(),name:'DairyMonitor',publisher:{'@id':`${siteUrl}#organization`},inLanguage:['en','ur']},
 {'@type':'SoftwareApplication',name:'DairyMonitor',applicationCategory:'BusinessApplication',operatingSystem:'Web',url:siteUrl.toString(),description:'Dairy farm management software for herd, milk, health, feed, inventory, staff, accounting, and profitability records.',offers:{'@type':'Offer',price:'2500',priceCurrency:'PKR'}},
]};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,'\\u003c')}}/></body></html>}
