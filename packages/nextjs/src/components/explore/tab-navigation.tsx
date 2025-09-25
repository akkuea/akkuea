'use client';

import type React from 'react';
import ReactTooltip from 'react-tooltip'; // ✅ v4 tooltip import

type Tab = {
  id: string | number;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

type TabNavigationProps = {
  activeTab: string | number;
  setActiveTab: (id: string | number) => void;
  tabs: Tab[];
};

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, setActiveTab, tabs }) => {
  return (
    <div className="flex bg-card rounded-lg p-1 border border-border transition-colors duration-300">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          data-tip={`Go to ${tab.label}`} // ✅ tooltip text
          className={`px-6 py-2 rounded-md font-medium transition-colors w-full justify-center flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-primary hover:bg-primary/80 text-white'
              : 'text-muted hover:text-foreground'
          }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
      <ReactTooltip place="bottom" effect="solid" /> {/* ✅ global tooltip */}
    </div>
  );
};

export default TabNavigation;
