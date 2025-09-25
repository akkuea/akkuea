'use client';

import type { LucideIcon } from 'lucide-react';
import ReactTooltip from 'react-tooltip';

export interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isDarkMode: boolean;
  onClick: () => void;
}

export function NavButton({ icon, label, isActive, onClick }: NavButtonProps) {
  const Icon = icon;

  return (
    <>
      <button
        onClick={onClick}
        data-tip={label}
        className={
          isActive
            ? 'flex items-center flex-shrink-0 px-6 py-3 mx-1 bg-card text-primary rounded-lg shadow-sm'
            : 'flex items-center flex-shrink-0 px-6 py-3 mx-1 text-muted hover:bg-muted/20 rounded-lg transition-colors duration-200'
        }
      >
        <Icon className="w-5 h-5 mr-2" />
        <span>{label}</span>
      </button>
      <ReactTooltip place="top" effect="solid" />
    </>
  );
}
