import React from 'react';
import { Search } from 'lucide-react';

const EmptyState = () => {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
      <p className="text-gray-500">Try adjusting your search or browse popular topics instead.</p>
    </div>
  );
};

export default EmptyState;
