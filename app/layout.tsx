import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ינאי בתי צמיחה - מערכת הזמנות',
  description: 'מערכת ניהול הזמנות ומלאי עבור לקוחות ינאי בתי צמיחה (משתלת ינאי). הכנסו להזמנת עציצים וצמחים.',
  keywords: [
    'ינאי בתי צמיחה', 
    'משתלות ינאי', 
    'הזמנות ינאי בתי צמיחה', 
    'משתלת ינאי', 
    'מערכת הזמנות ינאי', 
    'ינאי צמחים', 
    'התחברות ינאי בתי צמיחה'
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
