'use client';

import { useState } from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const ThemeSection = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 mb-6 shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-teal-500 dark:text-teal-400">
          <Palette className="w-5 h-5" />
        </span>
        <h2 className="text-lg font-semibold">Theme</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-0 sm:ml-7">
        Customize how Akkuea looks for you
      </p>
      <input type="button" value="" />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 ml-0 sm:ml-7">
        <div
          className={`relative border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:border-teal-400 ${theme === 'light' ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10 shadow-sm shadow-teal-500' : 'border-gray-200 dark:border-gray-700'}`}
          onClick={() => setTheme('light')}
        >
          {theme === 'light' && (
            <span className="absolute top-2 right-2 text-teal-500">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-teal-500 rounded-full" />
            </span>
          )}
          <div className="flex flex-col gap-1 sm:gap-2">
            <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            <span className="font-medium text-sm sm:text-base">Light</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Light background with dark text
            </span>
          </div>
        </div>

        <div
          className={`relative border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:border-teal-400 ${theme === 'dark' ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10 shadow-sm shadow-teal-500' : 'border-gray-200 dark:border-gray-700'}`}
          onClick={() => setTheme('dark')}
        >
          {theme === 'dark' && (
            <span className="absolute top-2 right-2 text-teal-500">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-teal-500 rounded-full" />
            </span>
          )}
          <div className="flex flex-col gap-1 sm:gap-2">
            <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            <span className="font-medium text-sm sm:text-base">Dark</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Dark background with light text
            </span>
          </div>
        </div>

        <div
          className={`relative border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:border-teal-400 ${theme === 'system' ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10 shadow-sm shadow-teal-500' : 'border-gray-200 dark:border-gray-700'}`}
          onClick={() => setTheme('system')}
        >
          {theme === 'system' && (
            <span className="absolute top-2 right-2 text-teal-500">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-teal-500 rounded-full" />
            </span>
          )}
          <div className="flex flex-col gap-1 sm:gap-2">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
            <span className="font-medium text-sm sm:text-base">System</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Follow system preferences
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LanguageSection = () => {
  const [interfaceLanguage, setInterfaceLanguage] = useState('English');
  const [contentLanguages, setContentLanguages] = useState<string[]>(['English', 'Español']);

  // Available languages
  const languages = [
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
    { id: 'fr', name: 'Français' },
    { id: 'de', name: 'Deutsch' },
    { id: 'pt', name: 'Português' },
    { id: 'ja', name: '日本語' },
  ];

  const toggleContentLanguage = (language: string) => {
    setContentLanguages((prev) =>
      prev.includes(language) ? prev.filter((lang) => lang !== language) : [...prev, language]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 sm:p-6 shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-teal-500 dark:text-teal-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-globe"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold">Language</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-0 sm:ml-7">
        Choose your preferred language
      </p>

      <div className="ml-0 sm:ml-7 mb-6 w-full max-w-xs">
        <Select value={interfaceLanguage} onValueChange={setInterfaceLanguage}>
          <SelectTrigger className="w-full border dark:border-white/50">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.id} value={lang.name}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-0 sm:ml-7">
        <h3 className="text-base font-medium mb-2">Content Language</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select your preferred language for content display
        </p>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          {languages.map((lang) => (
            <div
              key={lang.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/30"
            >
              <div className="relative" onClick={() => toggleContentLanguage(lang.name)}>
                <div
                  className={`w-8 sm:w-10 h-5 rounded-full transition-colors ${contentLanguages.includes(lang.name) ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${contentLanguages.includes(lang.name) ? 'translate-x-3 sm:translate-x-5' : ''}`}
                  />
                </div>
              </div>
              <span className="text-sm font-medium">{lang.name}</span>
            </div>
          ))}
        </div>

        {contentLanguages.length > 0 && (
          <div className="mt-4 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/30 rounded-md">
            <p className="text-sm font-medium">Selected languages:</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
              {contentLanguages.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const AppearanceTab = () => {
  return (
    <>
      <ThemeSection />
      <LanguageSection />
    </>
  );
};
