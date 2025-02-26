'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import AkkueaLogo from '@/components/logo/akkueaLogo';

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
      // simulated Suggestions
      const simulatedSuggestions = [
        `${searchQuery} en Akkuea`,
        `Buscar ${searchQuery}`,
        `${searchQuery} populares`,
      ];
      setSuggestions(simulatedSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    //Add here the logic to search
  };

  return (
    <nav className="w-full border-b bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <AkkueaLogo className="h-8 w-auto" />
        </Link>

        {/* Search Bar */}
        <div className="flex-1 max-w-3xl mx-auto relative" ref={searchRef}>
          <Input
            type="search"
            placeholder="Search..."
            className="w-full pl-10 h-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-card border border-border mt-1 rounded-md shadow-lg">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-4 py-2 hover:bg-muted cursor-pointer text-foreground"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
