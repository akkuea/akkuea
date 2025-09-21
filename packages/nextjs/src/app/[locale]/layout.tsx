'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

interface RootLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default function RootLayout({ children, params: { locale } }: RootLayoutProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any>(undefined);
  const router = useRouter();

  useEffect(() => {
    const storedLocale = localStorage.getItem('language');
    if (storedLocale && storedLocale !== locale) {
      const newPathname = window.location.pathname.replace(/^\/[a-z]{2}/, `/${storedLocale}`);
      router.replace(newPathname);
    }
  }, [locale, router]);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const importedMessages = (await import(`../../../messages/${locale}.json`)).default;
        setMessages(importedMessages);
      } catch (error) {
        console.error(`Failed to load messages for locale: ${locale}`, error);
      }
    };
    loadMessages();
  }, [locale]);

  if (!messages) {
    return (
      <html lang={locale} suppressHydrationWarning>
        <body>
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
