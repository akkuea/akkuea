import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learning Hub',
  description: 'A platform for continuous learning and development',
};

export default function RootLayout({ children }: { children:React.ReactNode }) {
  return children;
}
