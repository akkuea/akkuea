'use client';
import { LucideIcon } from 'lucide-react';
import { SectionDescription } from './section-components';

export interface GenericSettingsTabProps {
  tabName: string;
  icon: LucideIcon;
  isDarkMode: boolean;
}

export function GenericSettingsTab({ tabName, icon: Icon, isDarkMode }: GenericSettingsTabProps) {
  return (
    <div className="p-6">
      <div className="flex items-center mb-2">
        <Icon
          className={isDarkMode ? 'w-6 h-6 mr-2 text-teal-400' : 'w-6 h-6 mr-2 text-teal-600'}
        />
        <h1
          className={
            isDarkMode ? 'text-2xl font-bold text-teal-400' : 'text-2xl font-bold text-teal-700'
          }
        >
          {tabName.charAt(0).toUpperCase() + tabName.slice(1)} Settings
        </h1>
      </div>
      <SectionDescription
        text={`${tabName.charAt(0).toUpperCase() + tabName.slice(1)} settings will be available soon.`}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
