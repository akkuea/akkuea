/**
 * Footer Navigation Item Component
 *
 * Reusable navigation item with accessibility features and interaction states:
 * - default, hover, active, focus variants
 * - Proper ARIA attributes and keyboard navigation
 * - Touch targets meet 44px minimum requirement
 */

import React from 'react';

interface NavItemProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}

export function NavItem({ href, children, className = '', onClick }: NavItemProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center
        text-white dark:text-black hover:text-gray-300 dark:hover:text-gray-600
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        active:text-primary
        min-h-[44px] min-w-[44px]
        ${className}
      `}
      role="button"
      tabIndex={0}
    >
      {children}
    </a>
  );
}
