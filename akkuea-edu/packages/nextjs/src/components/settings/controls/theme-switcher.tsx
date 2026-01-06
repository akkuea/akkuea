'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[64px] h-[24px] bg-muted rounded-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {resolvedTheme === 'dark' ? (
            <>
              <Sun className="h-5 w-5 text-achievement" />
              <h3 className="text-lg font-semibold">Light Mode</h3>
            </>
          ) : (
            <>
              <Moon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Dark Mode</h3>
            </>
          )}
        </div>
        <Switch
          id="theme-toggle"
          checked={resolvedTheme === 'dark'}
          onCheckedChange={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="data-[state=checked]:bg-primary"
        />
      </div>
      <p className="text-sm text-muted pl-8">Toggle between light and dark theme</p>
    </div>
  );
}
