'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import MediaUpload from '@/components/quick-post/media-upload';

interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
}

interface Message {
  id?: string;
  content: string;
  mediaUrl?: string;
  linkPreview?: LinkPreview | null;
  read?: boolean;
}

export const MessageInput = () => {
  const [newMessage, setNewMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      // Typing stopped
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleLinkPreview = async (url: string) => {
    try {
      const response = await fetch(`/api/fetchMetadata?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      setLinkPreview(data);
    } catch (error) {
      console.error('Error fetching link preview:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !mediaUrl) return;

    const message: Message = {
      content: newMessage,
      read: true,
      mediaUrl,
      linkPreview,
    };

    // Here you would typically send the message to your backend
    console.log('Sending message:', message);

    setNewMessage('');
    setMediaUrl(undefined);
    setLinkPreview(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMediaUpload = (files: File[]) => {
    // Here you would typically upload the file to your storage
    // For now, we'll just create an object URL
    if (files.length > 0) {
      setMediaUrl(URL.createObjectURL(files[0]));
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-t">
      <MediaUpload onUpload={handleMediaUpload} />
      <Input
        value={newMessage}
        onChange={(e) => {
          setNewMessage(e.target.value);
          handleTyping();

          // Check for links in the message
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = e.target.value.match(urlRegex);
          if (urls && (!linkPreview || linkPreview.url !== urls[0])) {
            handleLinkPreview(urls[0]);
          }
        }}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        className="flex-1"
      />
      <Button onClick={handleSendMessage} disabled={!newMessage.trim() && !mediaUrl} size="icon">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}; 