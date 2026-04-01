import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'gigHood | AI Income Protection for Gig Workers',
  description: 'Parametric income protection platform with project website, worker app, and admin surface.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
