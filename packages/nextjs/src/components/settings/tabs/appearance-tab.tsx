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
import ReactTooltip from 'react-tooltip';

export const ThemeSection = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 mb-6 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">
          <Palette className="w-5 h-5" />
        </span>
        <h2 className="text-lg font-semibold">Theme</h2>
      </div>
      <p className="text-sm text-muted mb-4 ml-0 sm:ml-7">Customize how Akkuea looks for you</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 ml-0 sm:ml-7">
        <div
          data-tip="Light theme"
          className={`relative border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:border-primary ${
            theme === 'light' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'
          }`}
          onClick={() => setTheme('light')}
        >
          {theme === 'light' && (
            <span className="absolute top-2 right-2 text-primary">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-primary rounded-full" />
            </span>
          )}
          <div className="flex flex-col gap-1 sm:gap-2">
            <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-achievement" />
            <span className="font-medium text-sm sm:text-base">Light</span>
            <span className="text-xs text-muted">Light background with dark text</span>
          </div>
        </div>

        <div
          data-tip="Dark theme"
          className={`relative border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:border-primary ${
            theme === 'dark' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'
          }`}
          onClick={() => setTheme('dark')}
        >
          {theme === 'dark' && (
            <span className="absolute top-2 right-2 text-primary">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-primary rounded-full" />
            </span>
          )}
          <div className="flex flex-col gap-1 sm:gap-2">
            <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span className="font-medium text-sm sm:text-base">Dark</span>
            <span className="text-xs text-muted">Dark background with light text</span>
          </div>
        </div>

        <div
          data-tip="System theme"
          className={`relative border rounded-lg p-3 sm:p-4 cursor-pointer transition-all hover:border-primary ${
            theme === 'system' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'
          }`}
          onClick={() => setTheme('system')}
        >
          {theme === 'system' && (
            <span className="absolute top-2 right-2 text-primary">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-primary rounded-full" />
            </span>
          )}
          <div className="flex flex-col gap-1 sm:gap-2">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-muted" />
            <span className="font-medium text-sm sm:text-base">System</span>
            <span className="text-xs text-muted">Follow system preferences</span>
          </div>
        </div>
      </div>

      <ReactTooltip place="top" effect="solid" />
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
    <div className="bg-card rounded-xl p-4 sm:p-6 shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">
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
      <p className="text-sm text-muted mb-4 ml-0 sm:ml-7">Choose your preferred language</p>

      <div className="ml-0 sm:ml-7 mb-6 w-full max-w-xs">
        <Select value={interfaceLanguage} onValueChange={setInterfaceLanguage}>
          <SelectTrigger className="w-full border border-border">
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
        <p className="text-sm text-muted mb-4">
          Select your preferred language for content display
        </p>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          {languages.map((lang) => (
            <div
              key={lang.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/20"
              data-tip={`Toggle ${lang.name}`}
            >
              <div className="relative" onClick={() => toggleContentLanguage(lang.name)}>
                <div
                  className={`w-8 sm:w-10 h-5 rounded-full transition-colors ${
                    contentLanguages.includes(lang.name) ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                      contentLanguages.includes(lang.name) ? 'translate-x-3 sm:translate-x-5' : ''
                    }`}
                  />
                </div>
              </div>
              <span className="text-sm font-medium">{lang.name}</span>
            </div>
          ))}
        </div>
        {contentLanguages.length > 0 && (
          <div className="mt-4 p-2 sm:p-3 bg-muted/20 rounded-md">
            <p className="text-sm font-medium">Selected languages:</p>
            <p className="text-sm text-muted break-words">{contentLanguages.join(', ')}</p>
          </div>
        )}
      </div>

      <ReactTooltip place="top" effect="solid" />
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
