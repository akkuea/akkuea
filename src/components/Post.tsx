import { useState } from 'react';
import type { Post, Comment } from '../utils/mockData';
import { HeartIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import CommentList from './CommentList';

type PostProps = Post;

export default function Post(post: PostProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [newComment, setNewComment] = useState('');

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: comments.length + 1,
      userId: 1, // Current user ID
      username: 'currentUser',
      avatar: 'https://i.pravatar.cc/150?img=1',
      content: newComment,
      timestamp: new Date().toLocaleDateString()
    };

    setComments([...comments, comment]);
    setNewComment('');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
      <div className="flex items-center mb-4">
        <a href={`/profile/${post.userId}`} className="flex items-center hover:opacity-80">
          <img src={post.avatar} alt={post.username} className="w-10 h-10 rounded-full" />
          <div className="ml-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">{post.username}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{post.timestamp}</p>
          </div>
        </a>
      </div>
      
      <p className="text-gray-800 dark:text-gray-200 mb-4">{post.content}</p>
      
      {post.image && (
        <img src={post.image} alt="Post content" className="rounded-lg mb-4 w-full" />
      )}
      
      <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
        <button 
          onClick={handleLike}
          className="flex items-center hover:text-primary-light dark:hover:text-primary-dark"
        >
          {isLiked ? (
            <HeartIconSolid className="w-5 h-5 mr-1 text-red-500" />
          ) : (
            <HeartIcon className="w-5 h-5 mr-1" />
          )}
          {likesCount}
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center ml-6 hover:text-primary-light dark:hover:text-primary-dark"
        >
          <ChatBubbleLeftIcon className="w-5 h-5 mr-1" />
          {comments.length}
        </button>
      </div>

      {showComments && (
        <div className="border-t dark:border-gray-700 pt-4">
          <CommentList comments={comments} />
          
          <form onSubmit={handleAddComment} className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-full hover:opacity-80"
              >
                Post
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}