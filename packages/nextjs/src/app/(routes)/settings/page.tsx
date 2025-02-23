'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ThemeSwitcher } from '@/components/settings/theme-switcher';
import { LanguageSelector } from '@/components/settings/language-selector';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (langId: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(langId) ? prev.filter((id) => id !== langId) : [...prev, langId]
    );
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto shadow-md border-t-4 border-t-teal-500 dark:border-t-teal-400 dark:bg-gray-900">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-teal-700 dark:text-teal-400">
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <ThemeSwitcher />
            <Separator className="my-6" />
            <LanguageSelector
              selectedLanguages={selectedLanguages}
              onLanguageChange={handleLanguageChange}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
