import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { DonateFooter } from '../components/donate-footer';

export const metadata: Metadata = {
  title: 'Phish Thumbprint',
  description: 'Your Phish history, added up and read back.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          {children}
          <DonateFooter />
        </div>
      </body>
    </html>
  );
}
