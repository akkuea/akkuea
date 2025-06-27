'use client';

import { cn } from '@/lib/utils';
import type { MessageBubbleProps } from '@/app/Types/messages';
import { useState } from 'react';

import { Avatar } from './avatar';
import Image from 'next/image';

export function MessageBubble({ message }: MessageBubbleProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className={cn('flex', message.type === 'sent' ? 'justify-end' : 'justify-start')}>
      <div className="flex flex-col space-y-1 max-w-[75%] sm:max-w-[70%]">
        <div className="flex items-end gap-2">
          {message.type === 'received' && (
            <Avatar name={message.sender} imageUrl={message.senderAvatar} size="sm" />
          )}
          <div
            className={cn(
              'px-3 py-2 rounded-lg',
              message.type === 'sent' ? 'bg-[#00CECE] text-white' : 'bg-gray-200'
            )}
          >
            {message.mediaUrl && (
              <div className="mb-2 relative">
                <Image
                  src={message.mediaUrl || '/placeholder.svg'}
                  alt="Media"
                  width={300}
                  height={200}
                  className={cn('rounded-lg max-w-full', !imageLoaded && 'hidden')}
                  onLoad={() => setImageLoaded(true)}
                />
                {!imageLoaded && <div className="w-48 h-48 bg-gray-300 rounded-lg animate-pulse" />}
              </div>
            )}
            {message.linkPreview && (
              <div className="mb-2 border rounded-lg overflow-hidden bg-white">
                {message.linkPreview.image && (
                  <Image
                    src={message.linkPreview.image || '/placeholder.svg'}
                    alt={message.linkPreview.title}
                    width={300}
                    height={200}
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="p-2">
                  <h4 className="font-semibold text-sm">{message.linkPreview.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{message.linkPreview.description}</p>
                  <a
                    href={message.linkPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 block"
                  >
                    {message.linkPreview.url}
                  </a>
                </div>
              </div>
            )}
            <p className="text-sm break-words">{message.content}</p>
          </div>
        </div>
        <span className="text-xs text-gray-500 px-2">
          {message.timestamp}
          {message.type === 'sent' && <span className="ml-2">{message.read ? '✓✓' : '✓'}</span>}
        </span>
      </div>
    </div>
  );
} 