import React from 'react';
import ReactTooltip from 'react-tooltip'; // ✅ v4 tooltip import

interface FilterTab {
  id: string;
  label: string;
  count: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`px-3 py-1 text-sm rounded-full ${
            activeTab === tab.id
              ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          onClick={() => onTabChange(tab.id)}
          data-tip={`Switch to ${tab.label} tab`} // ✅ tooltip text
        >
          {tab.label} {tab.count > 0 && <span>{tab.count}</span>}
        </button>
      ))}
      <ReactTooltip place="top" effect="solid" /> {/* ✅ global tooltip */}
    </div>
  );
};
