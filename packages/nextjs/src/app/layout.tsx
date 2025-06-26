import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import LeftSidebar from '@/components/learning-hub/left-sidebar';
import RightSidebar from '@/components/learning-hub/right-sidebar';
import { ThemeProvider } from '@/components/theme-provider'; // 👈 Ya hecho
import './globals.css';
import Navbar from '@/components/navbar/NavBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Learning Hub',
  description: 'A platform for continuous learning and development',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Navbar />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen bg-gray-50 dark:bg-black">
            <LeftSidebar />
            <main
              className="mt-14 transition-all duration-300 ease-in-out 
              md:ml-64 md:mr-64 
              px-4 py-8"
            >
              <div className="max-w-4xl mx-auto">{children}</div>
            </main>
            <RightSidebar />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
