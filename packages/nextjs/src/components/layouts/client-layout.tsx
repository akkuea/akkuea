'use client';

import { ThemeProvider } from 'next-themes';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <main className="min-h-screen bg-background antialiased pt-14">{children}</main>
    </ThemeProvider>
  );
} 