'use client';
import Link from 'next/link';
import {Globe2} from 'lucide-react';
import Brand from './brand';
import AccountNavigation from './account-navigation';
import CookieConsent from './cookie-consent';
import SocialLinks from './social-links';
import {useLanguage} from './language';
export default function PublicShell({children}:{children:React.ReactNode}){
 const {ur,t,toggle}=useLanguage();
 return <><header className="site-header public-header"><div className="container header-inner"><Brand/><nav className="main-nav"><Link href="/">{t('Home','ہوم')}</Link><Link href="/benefits">{t('Benefits','فوائد')}</Link><Link href="/features">{t('Features','خصوصیات')}</Link><Link href="/pricing">{t('Pricing','قیمتیں')}</Link><Link href="/blog">{t('Blog','بلاگ')}</Link><Link href="/contact">{t('Contact us','رابطہ')}</Link></nav><div className="header-actions"><button className="language" onClick={toggle}><Globe2 size={15}/>{ur?'English':'اردو'}</button><AccountNavigation ur={ur}/></div></div></header><main className="public-page">{children}</main><footer className="site-footer"><div className="container site-footer-grid"><div><Brand/><p>DairyMonitor brings herd, health, milk, stock, people, and farm finances into one connected workspace.</p><SocialLinks/></div><div><strong>Platform</strong><Link href="/benefits">Benefits</Link><Link href="/features">Features</Link><Link href="/pricing">Pricing</Link></div><div><strong>Company & legal</strong><Link href="/blog">Blog</Link><Link href="/contact">Contact us</Link><Link href="/privacy">Privacy policy</Link><Link href="/cookies">Cookie policy</Link><Link href="/terms">Terms</Link></div></div><div className="container site-footer-bottom"><span>© {new Date().getFullYear()} DairyMonitor</span><span>No credit card required · 14-day free trial</span></div></footer><CookieConsent/></>
}
