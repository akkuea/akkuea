export interface NotificationSettingsState {
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

export interface PrivacySettings {
  privateProfile: boolean;
  showOnlineStatus: boolean;
  contentFilter: 'off' | 'moderate' | 'strict';
}

export interface AccessibilitySettings {
  fontSize: number;
  highContrast: boolean;
  dyslexiaFont: boolean;
  reduceMotion: boolean;
  increaseCursor: boolean;
  enhancedFocus: boolean;
}
