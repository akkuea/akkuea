import React from 'react';

interface CategoryTagProps {
  category: {
    name: string;
    type:
      | 'pedagogy'
      | 'technology'
      | 'socioemotional'
      | 'methodologies'
      | 'neuroscience'
      | 'inclusive';
  };
}

export const CategoryTag: React.FC<CategoryTagProps> = ({ category }) => {
  const categoryConfig = {
    pedagogy: {
      bgColor: 'bg-emerald-100 dark:bg-emerald-900',
      textColor: 'text-emerald-700 dark:text-emerald-200',
      icon: '📚',
      label: 'Pedagogy',
    },
    technology: {
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-700 dark:text-blue-200',
      icon: '💻',
      label: 'Educational Technology',
    },
    socioemotional: {
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      textColor: 'text-purple-700 dark:text-purple-200',
      icon: '💜',
      label: 'Socioemotional Development',
    },
    methodologies: {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-700 dark:text-yellow-200',
      icon: '📋',
      label: 'Active Methodologies',
    },
    neuroscience: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-700 dark:text-red-200',
      icon: '🧠',
      label: 'Neuroscience',
    },
    inclusive: {
      bgColor: 'bg-indigo-100 dark:bg-indigo-900',
      textColor: 'text-indigo-700 dark:text-indigo-200',
      icon: '📊',
      label: 'Inclusive Education',
    },
  };

  const config = categoryConfig[category.type];

  return (
    <div
      className={`${config.bgColor} ${config.textColor} text-base px-2 py-1 rounded-md inline-flex items-center`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </div>
  );
}; 