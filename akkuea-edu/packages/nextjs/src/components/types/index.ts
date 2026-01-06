import { StaticImageData } from 'next/image';

export interface Author {
  id: string;
  name: string;
  avatar: string;
}

export interface Category {
  name: string;
  type:
    | 'pedagogy'
    | 'technology'
    | 'socioemotional'
    | 'methodologies'
    | 'neuroscience'
    | 'inclusive';
}

export interface Publication {
  id: string;
  title: string;
  description: string;
  image: string | StaticImageData;
  date: string;
  category: Category;
  author: Author;
  hasVideo?: boolean;
}
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

export interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
}
