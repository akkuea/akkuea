import React from 'react';
import { User, Heart, MessageCircle } from 'lucide-react';

type ContentCardProps = {
  type: 'trending' | 'featured';
  item: {
    author: string;
    readTime?: string;
    title: string;
    topic?: string;
    likes: number;
    comments: number;
    specialty?: string;
  };
};

const ContentCard: React.FC<ContentCardProps> = ({ type, item }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow mt-6">
      {type === 'trending' ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-200">{item.author}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{item.readTime}</div>
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-200 mb-4 leading-tight">
            {item.title}
          </h3>
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium bg-[#0D9488]/10 dark:bg-[#0D9488]/20  text-[#0D9488] dark:text-[#0D9488]`}
            >
              {item.topic}
            </span>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Heart className="w-4 h-4" />
                <span>{item.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span>{item.comments}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start flex-col justify-between mb-4">
            <div className="flex flex-row justify-between items-center  w-full">
              <h3 className="font-semibold text-gray-900 dark:text-gray-200 mb-2 text-lg">
                {item.title}
              </h3>
              <span className="px-3 py-1  bg-[#0D9488]/10 dark:bg-[#0D9488]/20  text-[#0D9488] dark:text-[#0D9488] text-sm font-medium rounded-full">
                Featured
              </span>
            </div>

            <div className="flex flex-row justify-between items-center w-full mt-4">
              <div className="flex  items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-200">{item.author}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{item.specialty}</div>
                </div>
              </div>

              {/*  */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span>{item.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{item.comments}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContentCard;
