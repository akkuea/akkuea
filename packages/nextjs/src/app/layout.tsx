import './globals.css';
import { Toaster } from 'sonner';

import type { Metadata } from 'next';

import { ThemeProvider } from '@/components/theme-provider';

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
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
