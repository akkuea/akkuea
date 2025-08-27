import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

import { SidebarsWrapper } from '@/components/layouts/sidebars-wrapper';
import Navbar from '@/components/navbar/navbar';

export const metadata: Metadata = {
  title: 'Learning Hub',
  description: 'A platform for continuous learning and development',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          <div className="min-h-screen bg-background text-foreground">
            <SidebarsWrapper />
            <main
              className="mt-14 transition-all duration-300 ease-in-out 
              md:ml-64 md:mr-64 
              px-4 py-8"
            >
              <div className="max-w-4xl mx-auto">{children}</div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}