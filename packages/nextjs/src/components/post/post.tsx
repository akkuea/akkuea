'use client';

import type React from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { Download, Eye, Flag, MessageCircle, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocalStorage } from '@/components/auth/store/storage';
import { CommentForm } from './comment-form';
import { CommentsSection } from './comments-section';
import { ReportDialog } from './report-dialog';
import { toast } from 'sonner';
import { Comment, PostProps } from '../auth/store/data/post-types';
import { useModalStore } from '@/store/useModalStore';

export default function Post({ id, author, content, categories = [], modal }: PostProps) {
  const isOpen = useModalStore((state) => state.isOpen);
  const [showComments, setShowComments] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [comments, setComments] = useLocalStorage<Comment[]>(`post-${id}-comments`, []);
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${author.name}`,
          text: content.text,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.info('Link copied to clipboard' + 'You can now share this post with others');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  const handleComment = (text: string) => {
    const newComment: Comment = {
      id: Date.now().toString(),
      text,
      author: 'User', // In a real app, this would come from auth
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [newComment, ...prev]);
  };

  const handleReport = (reason: string, details: string) => {
    // In a real app, this would send to an API
    console.log('Report submitted:', { reason, details });
    toast.info('Report submitted' + ' ' + 'Thank you for helping keep our community safe');
  };

  const handleDownload = async () => {
    if (content.media?.[0]?.downloadUrl) {
      try {
        const response = await fetch(content.media[0].downloadUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `post-${id}-media.${blob.type.split('/')[1]}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading:', error);
        toast.info('Download failed' + ' ' + 'There was an error downloading the file');
      }
    }
  };

  // function to render media content
  const renderMedia = (
    media: NonNullable<PostProps['content']['media']>[number],
    index: number
  ) => {
    switch (media.type) {
      case 'video':
        return (
          <div key={index} className="relative rounded-lg overflow-hidden border bg-muted">
            <iframe
              src={media.url}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      case 'image':
        return (
          <div key={index} className="relative rounded-lg overflow-hidden border bg-muted">
            <Image
              src={media.url || '/placeholder.svg'}
              alt={`Post image ${index + 1}`}
              width={600}
              height={media.aspectRatio ? 600 / media.aspectRatio : 400}
              className="w-full h-auto"
            />
          </div>
        );
      case 'embed':
        return (
          <div
            key={index}
            className="relative rounded-lg overflow-hidden border bg-muted"
            dangerouslySetInnerHTML={{ __html: media.url }}
          />
        );
      default:
        return null;
    }
  };

  //  function to render link previews
  const renderLinkPreview = (
    link: NonNullable<PostProps['content']['links']>[number],
    index: number
  ) => {
    return (
      <a
        key={index}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 rounded-lg border hover:bg-muted transition-colors"
      >
        <div className="flex gap-4">
          {link.image && (
            <div className="relative w-24 h-24 flex-shrink-0">
              <Image
                src={link.image || '/placeholder.svg'}
                alt={link.title || 'Link preview'}
                fill
                className="object-cover rounded-md"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium line-clamp-1">{link.title || link.url}</h3>
            {link.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{link.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{new URL(link.url).hostname}</p>
          </div>
        </div>
      </a>
    );
  };

  return (
    <Card className="max-w-4xl w-full p-4">
      <div className="flex flex-row justify-between items-center p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={author.avatar} alt={author.name} />
            <AvatarFallback>{author.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold">{author.name}</span>
            <span className="text-sm text-muted-foreground">@{author.username}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {!isOpen && (
            <Button variant="ghost" size="icon" className="ml-auto" onClick={modal}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => setReportDialogOpen(true)}
          >
            <Flag className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4 pt-0 space-y-4">
        {/* CHANGE: Text content with better formatting */}
        <p className="text-base whitespace-pre-wrap break-words">{content.text}</p>

        {/* CHANGE: Multiple media items support */}
        {content.media && content.media.length > 0 && (
          <div className="grid gap-4">
            {content.media.map((media, index) => renderMedia(media, index))}
          </div>
        )}

        {/* CHANGE: Link previews support */}
        {content.links && content.links.length > 0 && (
          <div className="grid gap-4">
            {content.links.map((link, index) => renderLinkPreview(link, index))}
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {categories.map((category, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 text-[#008B8B] bg-[#EBFBFA]"
            >
              {category.icon}
              {category.name}
            </Badge>
          ))}
        </div>
      </div>
      <div className="p-4 pt-0 flex flex-col gap-4">
        <div className="flex justify-between items-center max-[400px]:flex-col w-full">
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#008B8B]"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Comment {comments.length > 0 && `(${comments.length})`}
            </Button>
            <Button variant="ghost" size="sm" className="text-[#008B8B]" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>
          {content.media?.[0]?.downloadUrl && (
            <Button variant="ghost" size="sm" className="text-[#008B8B]" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          )}
        </div>
        {showComments && (
          <div className="w-full space-y-4">
            <CommentForm onSubmit={handleComment} userInitials="U" />
            <CommentsSection comments={comments} />
          </div>
        )}
      </div>
      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        onSubmit={handleReport}
      />
    </Card>
  );
}
