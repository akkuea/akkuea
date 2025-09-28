'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, Link as LinkIcon, FileText, ExternalLink } from 'lucide-react';

// Define the types of posts
type ContentType = 'image' | 'text' | 'video' | 'link' | 'mixed';

interface Post {
  id: string;
  contentType: ContentType;
  thumbnail?: string;
  title?: string;
  description?: string;
  url?: string;
  content?: string;
  videoUrl?: string;
}

const UserProfilePostsGrid: React.FC = () => {
  // Start with empty posts to avoid hydration errors
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Use useEffect to generate mock data on the client side only
  useEffect(() => {
    setIsMounted(true);
    // This will only run on the client
    const generateMockPosts = () => {
      // Seed with predictable values to avoid randomization issues
      const contentTypes: ContentType[] = [
        'image',
        'text',
        'video',
        'link',
        'mixed',
        'image',
        'image',
        'video',
        'text',
        'link',
        'mixed',
        'image',
      ];

      const mockPosts: Post[] = Array(12)
        .fill(null)
        .map((_, index) => {
          const contentType = contentTypes[index] as ContentType;
          const placeholderImg = `/api/placeholder/600/600?text=Post+${index}`;

          return {
            id: `post-${index}`,
            contentType,
            thumbnail: index % 3 === 0 && contentType !== 'text' ? undefined : placeholderImg,
            title: `Post ${index}`,
            description: `This is the description for post ${index}`,
            url:
              contentType === 'link' || contentType === 'mixed' ? 'https://example.com' : undefined,
            content:
              contentType === 'text'
                ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies.'
                : undefined,
            videoUrl: contentType === 'video' ? 'https://example.com/video.mp4' : undefined,
          };
        });

      setPosts(mockPosts);
      setIsLoading(false);
    };

    generateMockPosts();
  }, []);

  const PostCard = ({ post }: { post: Post }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
      <>
        <div
          className="rounded-lg overflow-hidden aspect-square mt-[2em] relative group cursor-pointer bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsDialogOpen(true)}
        >
          {post.contentType === 'mixed' && (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
              <FileText className="h-10 w-10 mb-2" />
              <span>Mixed content</span>
            </div>
          )}

          {post.contentType === 'image' && post.thumbnail && (
            <div className="w-full h-full relative">
              <Image
                src={post.thumbnail}
                alt={post.title || 'Post thumbnail'}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
                priority={false}
              />
            </div>
          )}

          {post.contentType === 'video' && (
            <div className="w-full h-full relative ">
              {post.thumbnail ? (
                <>
                  <Image
                    src={post.thumbnail}
                    alt={post.title || 'Video thumbnail'}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-gray-800/70 rounded-full p-2">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <Play className="h-10 w-10 text-gray-500" />
                  <span className="mt-2 text-gray-500">Video</span>
                </div>
              )}
            </div>
          )}

          {post.contentType === 'text' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <FileText className="h-10 w-10 text-gray-500 mb-2" />
              {post.title && <h3 className="font-medium text-center">{post.title}</h3>}
              {post.description && (
                <p className="text-sm text-gray-500 text-center mt-2 line-clamp-3">
                  {post.description}
                </p>
              )}
            </div>
          )}

          {post.contentType === 'link' && (
            <div className="w-full h-full relative">
              {post.thumbnail ? (
                <>
                  <Image
                    src={post.thumbnail}
                    alt={post.title || 'Link thumbnail'}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-gray-800/70 rounded-full p-2">
                    <ExternalLink className="h-6 w-6 text-white" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <LinkIcon className="h-10 w-10 text-gray-500" />
                  <span className="mt-2 text-gray-500">Link</span>
                </div>
              )}
            </div>
          )}

          {/* Only show hover effect when component is mounted to avoid hydration errors */}
          {isMounted && (
            <div
              className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 transition-opacity duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {post.title && <h3 className="font-bold mb-1 text-center">{post.title}</h3>}
              {post.description && (
                <p className="text-sm text-gray-200 line-clamp-3 text-center">{post.description}</p>
              )}
              <div className="mt-2 text-xs">Click to view</div>
            </div>
          )}
        </div>

        {/* Dialog for post content preview */}
        {isDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setIsDialogOpen(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 p-4 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">
                {post.title ||
                  `${post.contentType.charAt(0).toUpperCase() + post.contentType.slice(1)} Post`}
              </h2>
              <div className="mb-4">
                {post.thumbnail && post.contentType !== 'text' && (
                  <div className="relative w-full h-96 mb-4">
                    <Image
                      src={post.thumbnail}
                      alt={post.title || 'Post content'}
                      fill
                      className="object-contain"
                    />
                  </div>
                )}
                <p>{post.description}</p>
                {post.content && <div className="mt-4">{post.content}</div>}
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:underline mt-4"
                  >
                    Visit Link <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <button
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded"
                onClick={() => setIsDialogOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  // Simple inline skeleton component
  const PostSkeleton = () => (
    <div className="rounded-lg overflow-hidden aspect-square animate-pulse bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 mt-[2em]"></div>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {isLoading &&
          Array(12)
            .fill(null)
            .map((_, index) => <PostSkeleton key={`skeleton-${index}`} />)}
      </div>
    </div>
  );
};

export default UserProfilePostsGrid;
