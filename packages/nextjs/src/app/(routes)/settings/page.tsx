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

// ✅ react-tooltip
import ReactTooltip from 'react-tooltip';

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
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Settings</h1>

          <TabProvider>
            <div className="bg-card rounded-lg shadow-sm border border-border">
              <TabNav>
                <TabItem
                  icon={<Palette />}
                  label="Appearance"
                  value="appearance"
                  data-tip
                  data-for="appearanceTip"
                />
                <ReactTooltip id="appearanceTip" place="top" effect="solid">
                  Customize theme, colors, and layout
                </ReactTooltip>

                <TabItem
                  icon={<Bell />}
                  label="Notifications"
                  value="notifications"
                  data-tip
                  data-for="notificationsTip"
                />
                <ReactTooltip id="notificationsTip" place="top" effect="solid">
                  Manage alerts, sounds, and reminders
                </ReactTooltip>

                <TabItem
                  icon={<LockKeyhole />}
                  label="Privacy"
                  value="privacy"
                  data-tip
                  data-for="privacyTip"
                />
                <ReactTooltip id="privacyTip" place="top" effect="solid">
                  Control your privacy and security settings
                </ReactTooltip>

                <TabItem
                  icon={<User />}
                  label="Account"
                  value="account"
                  data-tip
                  data-for="accountTip"
                />
                <ReactTooltip id="accountTip" place="top" effect="solid">
                  Update account info and verification
                </ReactTooltip>

                <TabItem
                  icon={<Eye />}
                  label="Accessibility"
                  value="accessibility"
                  data-tip
                  data-for="accessibilityTip"
                />
                <ReactTooltip id="accessibilityTip" place="top" effect="solid">
                  Adjust accessibility and ease-of-use options
                </ReactTooltip>
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
                  <PrivacyTab />
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
