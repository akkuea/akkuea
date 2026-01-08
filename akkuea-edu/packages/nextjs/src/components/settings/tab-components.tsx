'use client';
import type React from 'react';
import type { ReactNode } from 'react';
import { useTab, type TabType } from '@/contexts/TabContext';

interface TabNavProps {
  children: ReactNode;
}

export const TabNav: React.FC<TabNavProps> = ({ children }) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-center gap-2 sm:gap-1 p-2 sm:p-4 bg-card border-b border-border rounded-t-lg overflow-x-auto">
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
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ease-in-out ${
        isActive ? 'bg-background text-primary shadow-sm' : 'text-muted hover:bg-muted/20'
      } focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
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
