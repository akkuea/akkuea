import React from 'react';
import { Search, Filter, Compass } from 'lucide-react';

interface ExploreHeaderProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

const ExploreHeader: React.FC<ExploreHeaderProps> = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-8 h-8 bg-[#0D9488] rounded-lg flex items-center justify-center">
          <Compass className="w-5 h-5 text-white" />
        </div>
        <h1
          className="text-2xl font-semibold text-gray-900 dark:text-gray-200"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Explore
        </h1>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search for content, topics or users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 transition-colors duration-300"
          />
        </div>
        <button className="bg-[#59C9D0] hover:bg-[#4ab5bc] text-white px-4 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors dark:bg-teal-400 dark:hover:bg-teal-500">
          <Filter className="w-5 h-5" />
          Filters
        </button>
      </div>
    </div>
  );
};

export default ExploreHeader;
