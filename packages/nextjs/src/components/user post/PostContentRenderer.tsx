import React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { ExternalLink, Play, Link as LinkIcon, FileText } from 'lucide-react';

type ContentType = 'image' | 'text' | 'video' | 'link' | 'mixed';

interface Post {
  id: string;
  userId: string;
  contentType: ContentType;
  thumbnail?: string;
  title?: string;
  description?: string;
  url?: string;
  content?: string;
  videoUrl?: string;
  createdAt: string;
}

interface PostContentRendererProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

const PostContentRenderer: React.FC<PostContentRendererProps> = ({ post, isOpen, onClose }) => {
  const renderContent = () => {
    switch (post.contentType) {
      case 'image':
        return (
          <div className="w-full h-full max-h-[70vh] relative">
            {post.thumbnail && (
              <Image
                src={post.thumbnail}
                alt={post.title || 'Post image'}
                width={800}
                height={800}
                className="object-contain max-h-[70vh] mx-auto"
              />
            )}
          </div>
        );

      case 'video':
        return (
          <div className="w-full max-h-[70vh] bg-black">
            {post.videoUrl ? (
              <video
                src={post.videoUrl}
                controls
                className="w-full max-h-[70vh] mx-auto"
                poster={post.thumbnail}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Play className="h-12 w-12 mb-2" />
                <p>Video preview not available</p>
              </div>
            )}
          </div>
        );

      case 'text':
        return (
          <Card className="p-6 max-h-[70vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{post.title}</h2>
            <div className="prose dark:prose-invert">{post.content || post.description}</div>
          </Card>
        );

      case 'link':
        return (
          <Card className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="h-5 w-5 text-blue-500" />
              <h2 className="text-xl font-bold">{post.title || 'Shared Link'}</h2>
            </div>
            <p className="mb-4">{post.description}</p>
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-500 hover:underline"
              >
                Visit Link <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {post.thumbnail && (
              <div className="mt-4 rounded-md overflow-hidden">
                <Image
                  src={post.thumbnail}
                  alt="Link preview"
                  width={600}
                  height={400}
                  className="object-cover w-full"
                />
              </div>
            )}
          </Card>
        );

      case 'mixed':
        return (
          <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-4">
            {post.thumbnail && (
              <div className="rounded-md overflow-hidden">
                <Image
                  src={post.thumbnail}
                  alt={post.title || 'Post content'}
                  width={600}
                  height={400}
                  className="object-cover w-full"
                />
              </div>
            )}
            <Card className="p-4">
              <h2 className="text-xl font-bold mb-2">{post.title}</h2>
              <p>{post.description}</p>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-4 text-blue-500 hover:underline"
                >
                  Related Link <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </Card>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText className="h-12 w-12 mb-2" />
            <p>Content preview not available</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>
            {post.title ||
              `${post.contentType.charAt(0).toUpperCase() + post.contentType.slice(1)} Post`}
          </DialogTitle>
        </DialogHeader>
        <div className="p-0">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
};

export default PostContentRenderer;
