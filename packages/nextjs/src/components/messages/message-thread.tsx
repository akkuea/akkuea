'use client';

import { useMessages } from '@/store/messaging-store';
import { MessageBubble } from './message-bubble';
import { useEffect, useRef, useCallback } from 'react';

export function MessageThread() {
  const { messages, selectedConversationId } = useMessages();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedMessages = selectedConversationId ? messages[selectedConversationId] : [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {selectedMessages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
