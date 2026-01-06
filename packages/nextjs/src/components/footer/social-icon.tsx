/**
 * Social Icon Component
 *
 * Displays social media icons with proper external link attributes:
 * - default, hover, focus interaction states
 * - Opens in new tab with security attributes
 * - 44px minimum touch targets for accessibility
 */

import React from 'react';
import { MessageCircle, Github } from 'lucide-react';
import TwitterIcon from '../ui/twitter-icon';

type SocialPlatform = 'github' | 'telegram' | 'x';

interface SocialIconProps {
  platform: SocialPlatform;
  href: string;
}

const platformIcons: Record<SocialPlatform, React.ReactNode> = {
  github: <Github className="w-5 h-5" />,
  telegram: <MessageCircle className="w-5 h-5" />,
  x: <TwitterIcon className="w-5 h-5" />,
};

const platformLabels: Record<SocialPlatform, string> = {
  github: 'GitHub',
  telegram: 'Telegram',
  x: 'X (formerly Twitter)',
};

export function SocialIcon({ platform, href }: SocialIconProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="
        inline-flex items-center justify-center
        w-10 h-10 rounded-lg
        bg-slate-800
        text-gray-200 hover:bg-slate-900
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        min-h-[44px] min-w-[44px]
      "
      aria-label={`Follow us on ${platformLabels[platform]}`}
    >
      {platformIcons[platform]}
    </a>
  );
}
