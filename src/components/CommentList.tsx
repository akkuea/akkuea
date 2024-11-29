import type { Comment } from '../utils/mockData';

interface CommentListProps {
  comments: Comment[];
}

export default function CommentList({ comments }: CommentListProps) {
  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="flex space-x-3">
          <img
            src={comment.avatar}
            alt={comment.username}
            className="w-8 h-8 rounded-full"
          />
          <div className="flex-1">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                {comment.username}
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {comment.content}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {comment.timestamp}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}