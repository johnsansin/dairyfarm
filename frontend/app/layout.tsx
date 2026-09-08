import type { Metadata } from 'next';
import './globals.css';
import './redesign.css';
export const metadata: Metadata = { title: 'DairyMonitor — A clearer view of your farm', description: 'English and Urdu dairy farm management. Your herd, milk, and farm decisions in one place.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
