'use client';

import { cn } from '@/lib/utils';
import { Menu, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function HeaderLanding() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsNavOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav
      className="flex justify-between items-center px-4 md:px-20 py-5 bg-card fixed inset-x-0 z-50 text-[#0A0A0A]"
      ref={navRef}
    >
      <Link href="/" className="text-xl font-semibold">
        Akkuea
      </Link>
      <div
        className={cn(
          'flex justify-center items-center fixed inset-x-0 top-0 transition-all duration-300 -z-10 md:z-0 md:static md:translate-x-0',
          isNavOpen ? 'translate-x-0 backdrop-blur-md bg-opacity-90' : '-translate-x-full'
        )}
      >
        <ul className="flex flex-col md:flex-row justify-center items-center space-y-7 py-16 md:py-0 md:space-y-0 md:space-x-7 *:cursor-pointer">
          <li>Home</li>
          <li>About</li>
          <li>Benefits</li>
          <li>Roadmap</li>
          <li>Community</li>
          <li>Open Source</li>
        </ul>
      </div>
      <button className="md:hidden" onClick={() => setIsNavOpen(!isNavOpen)}>
        {isNavOpen ? <XIcon /> : <Menu />}
      </button>
    </nav>
  );
}
