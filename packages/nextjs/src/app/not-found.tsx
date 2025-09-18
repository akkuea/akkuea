"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function PathnameText() {
  const pathname = usePathname();
  if (!pathname) return null;
  return (
    <p className="mt-2 text-sm text-muted-foreground break-all" aria-live="polite">
      We couldn’t find <span className="font-medium text-foreground">{pathname}</span>
    </p>
  );
}

function QuickLinks() {
  const links = [
    { href: '/', label: 'Home' },
    { href: '/explore', label: 'Explore' },
    { href: '/communities', label: 'Communities' },
    { href: '/profile', label: 'Profile' },
    { href: '/settings', label: 'Settings' },
  ];
  return (
    <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Quick links">
      {links.map((l) => (
        <li key={l.href}>
          <Button asChild variant="secondary" className="w-full justify-center">
            <Link href={l.href}>{l.label}</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SearchForm() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    const url = query ? `/explore?query=${encodeURIComponent(query)}` : '/explore';
    router.push(url);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex w-full max-w-lg items-center gap-2" role="search" aria-label="Site search">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search topics, communities, or content"
        aria-label="Search"
        className="flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" onClick={() => router.back()} aria-label="Go back">
      Go back
    </Button>
  );
}

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mx-auto mb-8 h-40 w-40 sm:h-48 sm:w-48">
        <Image
          src="/globe.svg"
          alt="Illustration: globe with connections"
          fill
          priority
          sizes="(max-width: 640px) 10rem, 12rem"
          className="opacity-90 dark:opacity-80"
        />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-xl text-balance text-muted-foreground">
        Sorry, we can't find the page you're looking for. Try searching or use one of the quick links below.
      </p>
      <PathnameText />

      {/* Search */}
      <SearchForm />

      {/* Primary actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">Go to Home</Link>
        </Button>
        <BackButton />
      </div>

      {/* Helpful links */}
      <QuickLinks />

      <p className="mt-8 text-xs text-muted-foreground">Error code: 404</p>
    </main>
  );
}
