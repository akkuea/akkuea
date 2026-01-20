import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Akkuea DeFi RWA | Real Estate Tokenization Platform',
  description:
    'Democratizing real estate investment through blockchain tokenization. Fractional ownership, DeFi lending, and institutional-grade security on Stellar.',
  keywords: [
    'real estate tokenization',
    'DeFi',
    'Stellar blockchain',
    'fractional ownership',
    'RWA',
    'emerging markets',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black text-white`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
