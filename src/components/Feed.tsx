import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import Post from './Post';
import CreatePost from './CreatePost';
import { generateMockPost } from '../utils/mockData';

interface FeedProps {
  userId?: number;
}

export default function Feed({ userId }: FeedProps) {
  const [posts, setPosts] = useState<ReturnType<typeof generateMockPost>[]>(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const post = generateMockPost(i + 1);
      return userId ? { ...post, userId } : post;
    });
  });
  
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (inView) {
      const lastId = posts.length;
      const newPosts = Array.from({ length: 5 }, (_, i) => {
        const post = generateMockPost(lastId + i + 1);
        return userId ? { ...post, userId } : post;
      });
      setPosts(prev => [...prev, ...newPosts]);
    }
  }, [inView, userId, posts.length]);

  const handleCreatePost = (content: string, image?: File) => {
    const newPost = {
      id: Date.now(),
      userId: 1, // Current user ID
      username: 'currentUser',
      avatar: 'https://i.pravatar.cc/150?img=1',
      content,
      image: image ? URL.createObjectURL(image) : undefined,
      likes: 0,
      comments: [],
      isLiked: false,
      timestamp: new Date().toLocaleDateString()
    };
    
    setPosts(prev => [newPost, ...prev]);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-20">
      {!userId && <CreatePost onPost={handleCreatePost} />}
      {posts.map((post) => (
        <Post key={post.id} {...post} />
      ))}
      <div ref={ref} className="h-10" />
    </div>
  );
}