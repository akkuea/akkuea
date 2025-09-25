'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactTooltip from 'react-tooltip'; // ✅ v4 tooltip import

interface CommentFormProps {
  onSubmit: (comment: string) => void;
  userInitials: string;
}

export function CommentForm({ onSubmit, userInitials }: CommentFormProps) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      onSubmit(comment);
      setComment('');
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-2 items-start">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment..."
            className="min-h-[80px]"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={!comment.trim()} data-tip="Click to post your comment">
              Post Comment
            </Button>
          </div>
        </div>
      </form>
      <ReactTooltip place="top" effect="solid" />
    </>
  );
}
