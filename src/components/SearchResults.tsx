import type { User } from '../utils/mockData';

interface SearchResultsProps {
  results: User[];
  onClose: () => void;
}

export default function SearchResults({ results, onClose }: SearchResultsProps) {
  if (results.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
      {results.map((user) => (
        <a
          key={user.id}
          href={`/profile/${user.id}`}
          className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => onClose()}
        >
          <img
            src={user.avatar}
            alt={user.username}
            className="w-10 h-10 rounded-full"
          />
          <div className="ml-3">
            <p className="font-semibold text-gray-900 dark:text-white">
              {user.username}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.bio.substring(0, 50)}...
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}