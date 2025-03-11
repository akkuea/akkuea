import React from 'react';
import UserProfilePostsGrid from './post-grid/userprofilepost';

const UserProfileHeader = () => (
  <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
      <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-2">Username</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          User bio and description would go here. This would include information about the user,
          their interests, and any other relevant details.
        </p>
        <div className="flex gap-4">
          <div>
            <span className="font-bold">128</span> <span className="text-gray-500">posts</span>
          </div>
          <div>
            <span className="font-bold">1.2k</span> <span className="text-gray-500">followers</span>
          </div>
          <div>
            <span className="font-bold">456</span> <span className="text-gray-500">following</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const UserProfilePage = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <UserProfileHeader />
      <UserProfilePostsGrid />
    </div>
  );
};

export default UserProfilePage;
