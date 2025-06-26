'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import Skeleton from '@/components/user-post/skeleton';
import { useInView } from 'react-intersection-observer';
import { Play, Link, FileText, AlertCircle } from 'lucide-react';
import PostContentRenderer from './post-content-renderer';

// Define the types of posts
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

interface UserProfilePostsGridProps {
  userId: string;
  initialPosts?: Post[];
}

const UserProfilePostsGrid: React.FC<UserProfilePostsGridProps> = ({
  userId,
  initialPosts = [],
}) => {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  });

  // Wrap fetchPosts in useCallback
  const fetchPosts = useCallback(
    async (pageNum: number) => {
      if (!hasMore) return;

      setIsLoading(true);
      try {
        const mockData = Array(12)
          .fill(null)
          .map((_, index) => ({
            id: `post-${pageNum}-${index}`,
            userId,
            contentType: ['image', 'text', 'video', 'link', 'mixed'][
              Math.floor(Math.random() * 5)
            ] as ContentType,
            thumbnail: `https://via.placeholder.com/400x400?text=Post+${pageNum}-${index}`,
            title: `Post ${pageNum}-${index}`,
            description: `This is the description for post ${pageNum}-${index}`,
            url: 'https://example.com',
            content: 'Lorem ipsum dolor sit amet...',
            videoUrl: 'https://example.com/video.mp4',
            createdAt: new Date().toISOString(),
          }));

        setPosts((prevPosts) => (pageNum === 1 ? mockData : [...prevPosts, ...mockData]));
        setHasMore(pageNum < 3); // Limitar a 3 páginas
      } catch (error) {
        setError('Failed to load posts. Please try again.');
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [hasMore, userId]
  );

  // Load initial posts
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  // Handle infinite scroll
  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchPosts(nextPage);
    }
  }, [inView, isLoading, hasMore, fetchPosts, currentPage]);

  // Content type icon renderer
  const renderContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'video':
        return <Play className="h-6 w-6 text-white" />;
      case 'link':
        return <Link className="h-6 w-6 text-white" />;
      case 'text':
        return <FileText className="h-6 w-6 text-white" />;
      case 'mixed':
        return <FileText className="h-6 w-6 text-white" />;
      default:
        return null;
    }
  };

  // Post card component
  const PostCard = ({ post }: { post: Post }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
      <>
        <Card
          className="overflow-hidden aspect-square relative group cursor-pointer transition-all duration-200"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsDialogOpen(true)}
        >
          {post.thumbnail ? (
            <div className="w-full h-full relative">
              <Image
                src={post.thumbnail}
                alt={post.title || 'Post thumbnail'}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
                priority={false}
              />
              {/* Content type indicator */}
              {post.contentType !== 'image' && (
                <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full">
                  {renderContentTypeIcon(post.contentType)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              {post.contentType === 'text' ? (
                <div className="p-4 text-sm overflow-hidden max-h-full">
                  <h3 className="font-bold mb-2">{post.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 line-clamp-6">
                    {post.description}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500">
                  {renderContentTypeIcon(post.contentType)}
                  <span className="mt-2 text-sm">
                    {post.contentType.charAt(0).toUpperCase() + post.contentType.slice(1)} content
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Hover overlay */}
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
        </Card>

        {/* Post Content Preview Dialog */}
        <PostContentRenderer
          post={post}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      </>
    );
  };

  // Skeleton loader for posts
  const PostSkeleton = () => (
    <Card className="overflow-hidden aspect-square">
      <Skeleton className="w-full h-full" />
    </Card>
  );

  // Render loading skeletons
  const renderSkeletons = () => {
    return Array(12)
      .fill(null)
      .map((_, index) => <PostSkeleton key={`skeleton-${index}`} />);
  };

  return (
    <div className="w-full">
      {error && (
        <div className="flex items-center justify-center p-4 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md mb-4">
          <AlertCircle className="h-5 w-5 mr-2" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {isLoading && renderSkeletons()}
      </div>

      {/* Load more trigger element */}
      {hasMore && !error && <div ref={ref} className="h-20 w-full" />}

      {/* End of content message */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center text-gray-500 mt-8 mb-4">No more posts to load</div>
      )}
    </div>
  );
};

export default UserProfilePostsGrid;
