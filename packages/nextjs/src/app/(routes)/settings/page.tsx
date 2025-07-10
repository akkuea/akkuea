'use client';

import { useState, useEffect } from 'react';
import { Palette, Bell, LockKeyhole, User, Eye } from 'lucide-react';
import { TabProvider } from '@/contexts/TabContext';
import { TabNav, TabItem, TabContent } from '@/components/settings/tab-components';
import { AppearanceTab } from '@/components/settings/appearance-tab';
import { EmptyTabContent } from '@/components/settings/empty-tab-content';
import Notifications from '@/components/settings/Notifications';
import AccessibilityTab from '@/components/settings/accessibility-tab';
import Navbar from '@/components/navbar/NavBar';
import { AccountTab } from '@/components/settings/account-tab';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto">
        <div className="space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-teal-600 dark:text-teal-400">
            Settings
          </h1>

          <TabProvider>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <TabNav>
                <TabItem icon={<Palette />} label="Appearance" value="appearance" />
                <TabItem icon={<Bell />} label="Notifications" value="notifications" />
                <TabItem icon={<LockKeyhole />} label="Privacy" value="privacy" />
                <TabItem icon={<User />} label="Account" value="account" />
                <TabItem icon={<Eye />} label="Accessibility" value="accessibility" />
              </TabNav>

              <div className="p-4 sm:p-6">
                {/* Tab Contents */}
                <TabContent value="appearance">
                  <AppearanceTab />
                </TabContent>

                <TabContent value="notifications">
                  <Notifications />
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
              </div>
            </div>
          </TabProvider>
        </div>
      </div>
    </>
  );
}
