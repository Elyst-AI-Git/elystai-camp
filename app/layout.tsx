import type { Metadata } from 'next';
import { DM_Sans, Nunito } from 'next/font/google';
import './globals.css';
import './type-scale.css';
import './characters.css';
import './finance.css';
import './finance-overrides.css';
import './calendar.css';
import './review.css';
import './change-pass.css';
const dm = DM_Sans({subsets:['latin'],variable:'--font-body'}); const nunito = Nunito({subsets:['latin'],variable:'--font-display'});
export const metadata:Metadata={title:'Camp — Elyst AI',description:'The daily operating loop for two founders'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body className={`${dm.variable} ${nunito.variable}`}>{children}</body></html>}
