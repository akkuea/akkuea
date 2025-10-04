'use client';

import { Bell, Eye, LockKeyhole, Palette, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useGlobalAuthenticationStore } from '@/components/auth/store/data';
import Navbar from '@/components/navbar/navbar';
import { TabContent,TabItem, TabNav } from '@/components/settings/tab-components';
import AccessibilityTab from '@/components/settings/tabs/accessibility-tab';
import { AccountTab } from '@/components/settings/tabs/account-tab';
import { AppearanceTab } from '@/components/settings/tabs/appearance-tab';
import NotificationsTab from '@/components/settings/tabs/notifications-tab';
import { PrivacyTab } from '@/components/settings/tabs/privacy-tab';
import { TabProvider } from '@/contexts/TabContext';
// import { useTheme } from "next-themes"

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const address = useGlobalAuthenticationStore((state) => state.address);
  const router = useRouter();

  // const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true);
    if (!address) {
      router.push('/');
    }
  }, [address, router]);

  if (!mounted || !address) return null;

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
