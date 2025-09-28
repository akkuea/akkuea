'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({ api: '/api/chat' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-black text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 backdrop-blur-sm">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-5 w-5 text-teal-400" />
            <span>Akkuea AI Chat Assistant</span>
          </div>
        </div>
      </header>

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto p-4 container max-w-5xl mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
            <Bot className="h-12 w-12 text-teal-400" />
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome to Akkuea AI Chat Assistant
            </h2>
            <p className="text-zinc-400 max-w-sm">
              Start a conversation with the AI assistant. Ask questions, get
              information, or just chat.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex w-full',
                  message.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'flex items-start gap-3 max-w-md',
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-black',
                      message.role === 'user' ? 'bg-teal-400' : 'bg-zinc-400',
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>

                  {/* Message */}
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 shadow-md',
                      message.role === 'user'
                        ? 'bg-zinc-900 border-r-2 border-teal-400'
                        : 'bg-zinc-800 border-l-2 border-zinc-600',
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start w-full">
                <div className="flex items-start gap-3 max-w-md">
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-zinc-400 text-black">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="rounded-lg px-4 py-3 shadow-md bg-zinc-800 border-l-2 border-zinc-600">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}></div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800 bg-black p-4">
        <form
          onSubmit={handleSubmit}
          className="container flex gap-2 items-center max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-full border border-zinc-700 bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-100 placeholder:text-zinc-500"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full bg-teal-500 hover:bg-teal-600 h-12 w-12"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
