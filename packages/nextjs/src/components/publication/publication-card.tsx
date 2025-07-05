import React from 'react';
import Image from 'next/image';
import { CategoryTag } from './category-tag';
import { Publication } from '../types/index';
import { ArrowRight } from 'lucide-react';

interface PublicationCardProps {
  publication: Publication;
}

export const PublicationCard: React.FC<PublicationCardProps> = ({ publication }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col h-full transition-colors duration-300">
      {/* Card Image and Date */}
      <div className="relative">
        <div className="aspect-w-16 aspect-h-9">
          <Image
            src={publication.image}
            alt={publication.title}
            className="w-full h-full object-cover"
            width={300}
            height={170}
          />
        </div>
        {/* Date Badge */}
        <div className="absolute top-2 text-white w-32 h-7 right-2 bg-black/30 dark:bg-white/30 text-base font-medium px-2 py-1 rounded">
          {publication.date}
        </div>
        {/* Video Play Button if applicable */}
        {publication.hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-600 text-white rounded-full p-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="flex-grow flex flex-col">
        <div className="p-4">
          {/* Category Tag */}
          <div className="mb-3">
            <CategoryTag category={publication.category} />
          </div>

          {/* Title */}
          <h3 className="text-lg lead font-semibold mb-2 text-gray-900 dark:text-white">
            {publication.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-grow">
            {publication.description}
          </p>
        </div>
        {/* Author and View Button */}
        <div className="flex items-center justify-between mt-auto h-16 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
              <Image
                src={publication.author.avatar}
                alt={publication.author.name}
                className="w-full h-full object-cover"
                width={32}
                height={32}
              />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {publication.author.name}
            </span>
          </div>
          <button className="text-[#00CED1] dark:text-[#00CED1] border border-[#00CED1] p-2 rounded-lg shadow text-base font-medium flex items-center hover:bg-[#00CED1]/10 dark:hover:bg-[#00CED1]/20 transition-colors">
            View
            <ArrowRight className="text-base ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};
