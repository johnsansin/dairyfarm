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
export const metadata: Metadata = { title: 'DairyMonitor — A clearer view of your farm', description: 'English and Urdu dairy farm management. Your herd, milk, and farm decisions in one place.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
