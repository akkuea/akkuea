'use client';

import type React from 'react';
import { useState } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  Volume2,
  MessageSquare,
  Heart,
  AtSign,
  MessageCircle,
  Info,
  Users,
} from 'lucide-react';

interface NotificationSettingsState {
  enableNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  sound: boolean;
  comments: boolean;
  likes: boolean;
  mentions: boolean;
  newFollowers: boolean;
  directMessages: boolean;
  platformUpdates: boolean;
}

const NotificationsTab = () => {
  const [settings, setSettings] = useState<NotificationSettingsState>({
    enableNotifications: true,
    emailNotifications: true,
    pushNotifications: true,
    sound: true,
    comments: true,
    likes: true,
    mentions: true,
    newFollowers: true,
    directMessages: true,
    platformUpdates: true,
  });

  type SettingKey = keyof NotificationSettingsState;

  const toggleSetting = (key: SettingKey) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  interface ToggleProps {
    enabled: boolean;
    onChange: () => void;
  }

  interface SettingItemProps {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    description: string;
    settingKey: SettingKey;
    iconColor?: string;
  }

  const Toggle: React.FC<ToggleProps> = ({ enabled, onChange }) => (
    <div
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ease-in-out cursor-pointer ${
        enabled ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
          enabled ? 'translate-x-5' : ''
        }`}
      />
    </div>
  );

  const SettingItem: React.FC<SettingItemProps> = ({
    icon: Icon,
    title,
    description,
    settingKey,
    iconColor = 'text-primary',
  }) => (
    <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors duration-200">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 bg-primary/10 p-3 rounded">
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <Toggle enabled={settings[settingKey]} onChange={() => toggleSetting(settingKey)} />
    </div>
  );

  return (
    <div className="container bg-card rounded-lg shadow mx-auto mb-10 transition-colors duration-300 border border-border">
      {/* Header */}
      <div className="flex flex-col items-start mb-6 text-primary mt-4 h-[55.99px] px-4">
        <div className="flex flex-row items-center">
          <Bell size={22} className="mr-2" />
          <h1 className="text-xl text-foreground font-bold">Notification Preferences</h1>
        </div>
        <div>
          <p className="text-base text-muted font-normal">
            Control how and when you receive notifications
          </p>
        </div>
      </div>

      <div className="px-4 pb-6">
        {/* Master Toggle */}
        <div className="mb-8 border border-border rounded-lg">
          <SettingItem
            icon={Bell}
            title="Enable Notifications"
            description="Master toggle for all notifications"
            settingKey="enableNotifications"
            iconColor="text-primary"
          />
        </div>

        {/* Notification Channels */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-2">Notification Channels</h2>
          <p className="text-sm text-muted mb-4">Choose how you want to receive notifications</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <SettingItem
              icon={Mail}
              title="Email Notifications"
              description="Receive notifications via email"
              settingKey="emailNotifications"
              iconColor="text-secondary"
            />
            <div className="border-t border-border">
              <SettingItem
                icon={Smartphone}
                title="Push Notifications"
                description="Receive notifications on your device"
                settingKey="pushNotifications"
                iconColor="text-primary"
              />
            </div>
            <div className="border-t border-border">
              <SettingItem
                icon={Volume2}
                title="Sound"
                description="Play sound for notifications"
                settingKey="sound"
                iconColor="text-achievement"
              />
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Notification Types</h2>
          <p className="text-sm text-muted mb-4">
            Select which events you want to be notified about
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 dark:md:gap-0">
            {/* Left Column */}
            <div className="border border-border rounded-lg overflow-hidden">
              <SettingItem
                icon={MessageSquare}
                title="Comments"
                description="Receive alerts when someone comments on your posts"
                settingKey="comments"
                iconColor="text-primary"
              />
              <div className="border-t border-border">
                <SettingItem
                  icon={AtSign}
                  title="Mentions"
                  description="Receive alerts when someone mentions you"
                  settingKey="mentions"
                  iconColor="text-primary"
                />
              </div>
              <div className="border-t border-border">
                <SettingItem
                  icon={MessageCircle}
                  title="Direct messages"
                  description="Receive alerts for new direct messages"
                  settingKey="directMessages"
                  iconColor="text-primary"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="border border-border rounded-lg overflow-hidden">
              <SettingItem
                icon={Heart}
                title="Likes"
                description="Receive alerts when someone likes your content"
                settingKey="likes"
                iconColor="text-primary"
              />
              <div className="border-t border-border">
                <SettingItem
                  icon={Users}
                  title="New followers"
                  description="Receive alerts when someone follows you"
                  settingKey="newFollowers"
                  iconColor="text-primary"
                />
              </div>
              <div className="border-t border-border">
                <SettingItem
                  icon={Info}
                  title="Platform updates"
                  description="Receive alerts about platform updates and news"
                  settingKey="platformUpdates"
                  iconColor="text-primary"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsTab;
