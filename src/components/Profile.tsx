import type { User } from '../utils/mockData';

interface ProfileProps {
  user: User;
}

export default function Profile({ user }: ProfileProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex flex-col items-center">
        <img
          src={user.avatar}
          alt={user.username}
          className="w-24 h-24 rounded-full mb-4"
        />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {user.username}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
          {user.bio}
        </p>
        
        <div className="flex space-x-8 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.followers}
            </p>
            <p className="text-gray-600 dark:text-gray-400">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.following}
            </p>
            <p className="text-gray-600 dark:text-gray-400">Following</p>
          </div>
        </div>
        
        <button className="px-6 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-full hover:opacity-80">
          Follow
        </button>
      </div>
    </div>
  );
}