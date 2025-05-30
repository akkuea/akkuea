'use client';

import { useState, useEffect } from 'react';
import { Palette, Bell, LockKeyhole, User, Eye } from 'lucide-react';
import { TabProvider } from '@/contexts/TabContext';
import { TabNav, TabItem, TabContent } from '@/components/settings/TabComponents';
import { AppearanceTab } from '@/components/settings/AppearanceTab';
import { EmptyTabContent } from '@/components/settings/EmptyTabContent';
import Notifications from '@/components/settings/Notifications';
import AccessibilityTab from '@/components/settings/AccessibilityTab';
import Navbar from '@/components/navbar/NavBar';
import { AccountTab } from '@/components/settings/AccountTab';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto px-3 sm:p-4 md:p-6 pt-24 sm:pt-32 md:pt-40">
        <h1 className="text-xl sm:text-2xl font-bold text-teal-600 dark:text-teal-400 mb-4 sm:mb-6">
          Settings
        </h1>

        <TabProvider>
          <TabNav>
            <TabItem icon={<Palette />} label="Appearance" value="appearance" />
            <TabItem icon={<Bell />} label="Notifications" value="notifications" />
            <TabItem icon={<LockKeyhole />} label="Privacy" value="privacy" />
            <TabItem icon={<User />} label="Account" value="account" />
            <TabItem icon={<Eye />} label="Accessibility" value="accessibility" />
          </TabNav>

          {/* Tab Contents */}
          <TabContent value="appearance">
            <AppearanceTab />
          </TabContent>

          <TabContent value="notifications">
            <Notifications/>
          </TabContent>

          <TabContent value="privacy">
            <EmptyTabContent title="Privacy" />
          </TabContent>

          <TabContent value="account">
            <AccountTab
              email="jefferson@example.com"
              isEmailVerified={false}
              username="xJeffx23"
              onVerifyEmail={() => {
                /* trigger verification flow */
              }}
            />
          </TabContent>

          <TabContent value="accessibility">
            <AccessibilityTab />
          </TabContent>
        </TabProvider>
      </div>
    </>
  );
}
