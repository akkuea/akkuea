'use client';
import React from 'react';
import { Edit } from 'lucide-react';
import UserActivityDashboard from '@/components/activity/user-activity';
import PublicationMain from '@/components/publication/PublicationMain';
import Link from 'next/link';

const ProfilePage = () => {
  return (
    <div className="bg-white dark:bg-black container md:mx-auto shadow-sm p-6 transition-colors duration-300">
      <div className="flex flex-col md:flex-row items-start gap-6 md:pt-7 md:pl-10 container mx-auto rounded-lg py-8 px-4 border  dark:border-gray-700">
        <div className="w-full md:w-auto flex flex-col items-center justify-between md:items-start md:h-[270px] pt-6">
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full ring-4 ring-white dark:ring-gray-800 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center overflow-hidden shadow-lg">
            <svg
              className="w-16 h-16 md:w-20 md:h-20 text-gray-400 dark:text-gray-500 transition-transform hover:scale-110 duration-300"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>

        <div className="flex-1 pt-2 w-full mx-3">
          {/* username */}
          <div className="border-b pb-4 dark:border-gray-700">
            <div className="flex flex-col justify-between sm:flex-row sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors duration-200">
                  Jefferson Calderon
                </h1>
                <div className="text-gray-500 dark:text-gray-400 font-normal">@xJeffx23</div>
              </div>
              <Link
                href="/edit-profile"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-sm flex items-center gap-2 text-gray-700 dark:text-gray-300"
              >
                <Edit size={16} />
                Edit Profile
              </Link>
            </div>

            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 md:w-1/2">
              I am a crack designer, I like software engineering and also mixing as a DJ. Passionate
              about creating beautiful and functional digital experiences.
            </p>

            <div className="flex gap-2 mt-4">
              <span className="px-4 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-sm font-medium hover:bg-teal-100 dark:hover:bg-teal-800/30 transition-colors duration-200">
                Student
              </span>
              <span className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors duration-200">
                Designer
              </span>
            </div>
          </div>
          {/* following */}

          <div className="flex flex-row gap-8 my-4 border-b py-3 dark:border-gray-700">
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-gray-900 dark:text-white">15</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">posts</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-gray-900 dark:text-white">1,234</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">followers</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-gray-900 dark:text-white">567</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">following</span>
            </div>
          </div>

          <p className="font-normal text-gray-500 dark:text-gray-400 mb-2">
            National University of Design
          </p>
          <span className="text-[#00CED1] dark:text-teal-400 font-normal mt-5">
            &quot;Creating the future through design and technology&quot;
          </span>
        </div>
      </div>
      <PublicationMain />
      <UserActivityDashboard />
    </div>
  );
};

export default ProfilePage;
