'use client';
import { useState, useEffect } from 'react';
import { Bell, Eye, Lock, User, Palette, LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NavButton } from './nav-button';
import { AppearanceTab } from './appearance-tab';
import { PrivacyTab } from '@/components/settings/privacy';
import { GenericSettingsTab } from './generic-settings';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export default function SettingsUI() {
  // State
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('appearance');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = resolvedTheme === 'dark';

  const navItems: NavItem[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'account', label: 'Account', icon: User },
    { id: 'accessibility', label: 'Accessibility', icon: Eye },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-2">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
          <div className="h-96 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800"></div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceTab />;

      case 'privacy':
        return <PrivacyTab isDarkMode={isDarkMode} />;

      default:
        return (
          <GenericSettingsTab
            tabName={activeTab}
            icon={navItems.find((item) => item.id === activeTab)?.icon || Lock}
            isDarkMode={isDarkMode}
          />
        );
    }
  };

  return (
    <div className={isDarkMode ? 'bg-gray-950 min-h-screen p-2' : 'bg-gray-50 min-h-screen p-2'}>
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <h1
          className={
            isDarkMode
              ? 'text-xl sm:text-2xl font-bold text-teal-400 mb-4'
              : 'text-xl sm:text-2xl font-bold text-teal-700 mb-4'
          }
        >
          Settings
        </h1>

        {/* mobile Nav */}
        <div
          className={`flex overflow-x-auto whitespace-nowrap rounded-lg mb-10 ${isDarkMode ? 'bg-gray-800 p-2' : 'bg-gray-100 p-2'}`}
        >
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeTab === item.id}
              isDarkMode={isDarkMode}
              onClick={() => setActiveTab(item.id)}
            />
          ))}
        </div>

        {/* Content */}
        <div
          className={
            isDarkMode
              ? 'bg-gray-900 rounded-md border border-gray-800 mt-1'
              : 'bg-white rounded-md border border-gray-200 mt-1'
          }
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
