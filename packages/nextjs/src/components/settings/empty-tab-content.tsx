import React from 'react';

interface EmptyTabContentProps {
  title: string;
}

export const EmptyTabContent: React.FC<EmptyTabContentProps> = ({ title }) => {
  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400">This tab is currently under development.</p>
    </div>
  );
};
