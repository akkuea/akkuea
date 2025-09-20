'use client';

import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-md w-full mx-auto text-center px-4">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-8xl font-bold text-blue-500/20 mb-4">404</div>
          <div className="w-24 h-1 bg-blue-500 mx-auto rounded-full"></div>
        </div>

        {/* Error Message */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Page Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
            Oops! The page you&apos;re looking for seems to have wandered off into the digital void. 
            Don&apos;t worry, even the best explorers sometimes take a wrong turn.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          
          <Button asChild className="cursor-pointer">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
        </div>

        {/* Search Suggestion */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Looking for something specific?
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              // You can implement a search modal or redirect to search page
              const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
              if (searchInput) {
                searchInput.focus();
              } else {
                // Fallback: redirect to home page where search might be available
                router.push('/');
              }
            }}
          >
            <Search className="w-4 h-4 mr-2" />
            Try Searching
          </Button>
        </div>

        {/* Helpful Links */}
        {/* <div className="mt-8 text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">Popular destinations:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link 
              href="/home" 
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Learning Hub
            </Link>
            <span>•</span>
            <Link 
              href="/explore" 
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Explore
            </Link>
            <span>•</span>
            <Link 
              href="/communities" 
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Communities
            </Link>
          </div>
        </div> */}
      </div>
    </div>
  );
}
