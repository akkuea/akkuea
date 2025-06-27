'use client';

import React, { ReactNode } from 'react';
import { useTab, TabType } from '@/contexts/TabContext';

interface TabNavProps {
  children: ReactNode;
}

export const TabNav: React.FC<TabNavProps> = ({ children }) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-center gap-2 sm:gap-1 p-2 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 rounded-t-lg overflow-x-auto">
      {children}
    </div>
  );
};

interface TabItemProps {
  icon: ReactNode;
  label: string;
  value: TabType;
}

export const TabItem: React.FC<TabItemProps> = ({ icon, label, value }) => {
  const { activeTab, setActiveTab } = useTab();
  const isActive = activeTab === value;

  return (
    <button
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ease-in-out
        ${
          isActive
            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }
        focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
      onClick={() => setActiveTab(value)}
      role="tab"
      aria-selected={isActive}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
};

interface TabContentProps {
  value: TabType;
  children: ReactNode;
}

export const TabContent: React.FC<TabContentProps> = ({ value, children }) => {
  const { activeTab } = useTab();

  if (activeTab !== value) return null;

  return <>{children}</>;
};
