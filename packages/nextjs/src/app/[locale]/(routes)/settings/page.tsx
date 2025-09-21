'use client';

import { useState, useEffect } from 'react';
import { Palette, Bell, LockKeyhole, User, Eye } from 'lucide-react';
import { TabProvider } from '@/contexts/TabContext';
import { TabNav, TabItem, TabContent } from '@/components/settings/tab-components';
import { AppearanceTab } from '@/components/settings/tabs/appearance-tab';
import { PrivacyTab } from '@/components/settings/tabs/privacy-tab';
import NotificationsTab from '@/components/settings/tabs/notifications-tab';
import AccessibilityTab from '@/components/settings/tabs/accessibility-tab';
import Navbar from '@/components/navbar/navbar';
import { AccountTab } from '@/components/settings/tabs/account-tab';
// import { useTheme } from "next-themes"

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  // const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // const isDarkMode = resolvedTheme === "dark"

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto">
        <div className="space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Settings</h1>

          <TabProvider>
            <div className="bg-card rounded-lg shadow-sm border border-border">
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
                  <NotificationsTab />
                </TabContent>

                <TabContent value="privacy">
                  <PrivacyTab
                  // isDarkMode={isDarkMode}
                  />
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
