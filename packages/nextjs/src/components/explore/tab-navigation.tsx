'use client';

import type React from 'react';

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
    </div>
  );
};

export default TabNavigation;
