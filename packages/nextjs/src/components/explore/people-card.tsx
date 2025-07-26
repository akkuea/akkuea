import React from 'react';
import { User } from 'lucide-react';

interface Person {
  name: string;
  username: string;
  specialty: string;
  followers: number;
  posts: number;
}

interface PeopleCardProps {
  person: Person;
}

const PeopleCard: React.FC<PeopleCardProps> = ({ person }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow mt-6">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-3 flex items-center justify-center">
          <User className="w-8 h-8 text-gray-600 dark:text-gray-400" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-200">{person.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{person.username}</p>
        <p className="text-sm text-cyan-600 dark:text-teal-300 font-medium">{person.specialty}</p>
      </div>

      <div className="flex justify-center gap-6 text-sm text-gray-600 dark:text-gray-400 mb-4">
        <div className="text-center">
          <div className="font-semibold text-gray-900 dark:text-gray-200">
            {person.followers.toLocaleString()}
          </div>
          <div>followers</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-gray-900 dark:text-gray-200">{person.posts}</div>
          <div>posts</div>
        </div>
      </div>

      <button className="w-full bg-[#59C9D0] dark:bg-teal-400 hover:bg-cyan-600 dark:hover:bg-teal-500 text-white font-medium py-2 px-4 rounded-lg transition-colors">
        Follow
      </button>
    </div>
  );
};

export default PeopleCard;
