'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import AkkueaLogo from '@/components/logo/akkueaLogo';
import { useMessages } from '@/store/messaging-store';
import { MessagePreview } from '@/components/messages/MessagePreview';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWallet } from '@/components/auth/hooks/useWallet.hook';
import { useGlobalAuthenticationStore } from '@/components/auth/store/data';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { conversations } = useMessages();
  const unreadCount = conversations.reduce((count, conv) => count + (conv.unread ? 1 : 0), 0);
  const { handleConnect, handleDisconnect } = useWallet();
  const address = useGlobalAuthenticationStore((state) => state.address);

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
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
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

        {/* Navigation Icons */}
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/messages-private"
                  className="p-2 hover:bg-muted rounded-full transition-colors relative"
                >
                  <MessageCircle className="h-5 w-5" style={{ color: '#59C9D0' }} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#00CECE] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <MessagePreview />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Link href="/edit-profile" className="p-2 hover:bg-muted rounded-full transition-colors">
            <User className="h-5 w-5 text-muted-foreground" />
          </Link>
          {address ? (
            <Button
              onClick={handleDisconnect}
              className="bg-[#59C9D0] hover:bg-[#4ab5bc] text-white font-medium px-4 py-2 rounded-full transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              className="bg-[#59C9D0] hover:bg-[#4ab5bc] text-white font-medium px-4 py-2 rounded-full transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
