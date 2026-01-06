/**
 * Landing v1 / Footer
 *
 * Responsive footer component with three layout variants:
 * - Desktop (1440px+): Horizontal layout with logo left, nav center, socials right
 * - Tablet (1024px): Same horizontal structure with adjusted spacing
 * - Mobile (375px): Vertical stacking with centered alignment
 *
 * Features:
 * - Smooth scroll navigation for anchor links
 * - External social media links with proper attributes
 * - Accessibility-compliant interactions and focus states
 */
'use client';

import React from 'react';
import { NavItem, SocialIcon } from '../footer/index';

// Smooth scroll handler for navigation links
const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, href: string) => {
  if (href.startsWith('#')) {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }
};

const navigationLinks = [
  { label: 'About', href: '#about' },
  { label: 'Features', href: '#features' },
  { label: 'Roadmap', href: '#roadmap' },
  { label: 'Community', href: '#community' },
];

const bottomNavigationLinks = [{ label: 'Open Source', href: '#open-source' }];

const socialLinks = [
  { platform: 'github' as const, href: 'https://github.com/akkuea/akkuea' },
  { platform: 'telegram' as const, href: 'https://t.me/Akkuea' },
  { platform: 'x' as const, href: 'https://x.com/Akkuea_Official' },
];

export function FooterLanding() {
  return (
    <footer className="w-full bg-gray-900 dark:bg-white">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop & Tablet Layout (md+) */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-8">
            {/* Left: Logo */}
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold text-primary">Akkuea</span>
            </div>

            {/* Center: Navigation Links */}
            <nav className="flex flex-col items-center gap-2">
              {/* Top row: Main navigation */}
              <div className="flex items-center gap-6 lg:gap-8">
                {navigationLinks.map((link) => (
                  <NavItem
                    key={link.label}
                    href={link.href}
                    className="px-2 py-1.5 text-sm font-medium"
                    onClick={(e) => handleSmoothScroll(e, link.href)}
                  >
                    {link.label}
                  </NavItem>
                ))}
              </div>
              {/* Bottom row: Open Source */}
              <div className="flex items-center">
                {bottomNavigationLinks.map((link) => (
                  <NavItem
                    key={link.label}
                    href={link.href}
                    className="px-2 py-1.5 text-sm font-medium"
                    onClick={(e) => handleSmoothScroll(e, link.href)}
                  >
                    {link.label}
                  </NavItem>
                ))}
              </div>
            </nav>

            {/* Right: Social Icons */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <SocialIcon key={social.platform} platform={social.platform} href={social.href} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Layout (sm and below) */}
        <div className="block md:hidden">
          <div className="flex flex-col items-center space-y-6 mb-8">
            {/* Akkuea Logo */}
            <div className="text-center">
              <span className="text-2xl font-bold text-primary">Akkuea</span>
            </div>

            {/* Navigation Links (vertical list) */}
            <nav className="flex flex-col items-center space-y-4">
              {/* Main navigation links */}
              {navigationLinks.map((link) => (
                <NavItem
                  key={link.label}
                  href={link.href}
                  className="px-3 py-2 text-sm font-medium"
                  onClick={(e) => handleSmoothScroll(e, link.href)}
                >
                  {link.label}
                </NavItem>
              ))}
              {/* Open Source link */}
              {bottomNavigationLinks.map((link) => (
                <NavItem
                  key={link.label}
                  href={link.href}
                  className="px-3 py-2 text-sm font-medium"
                  onClick={(e) => handleSmoothScroll(e, link.href)}
                >
                  {link.label}
                </NavItem>
              ))}
            </nav>

            {/* Social Icons (horizontal row) */}
            <div className="flex items-center gap-6">
              {socialLinks.map((social) => (
                <SocialIcon key={social.platform} platform={social.platform} href={social.href} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row - Divider and Legal Text (all layouts) */}
        <div>
          {/* Horizontal Divider */}
          <div className="w-full h-px bg-gray-700 dark:bg-gray-200 mb-6" />

          {/* Copyright Text */}
          <div className="text-center">
            <p className="text-sm text-white dark:text-black">
              © 2025 Akkuea. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
