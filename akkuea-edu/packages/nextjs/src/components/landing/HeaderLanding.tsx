'use client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';
import { ArrowUpRight, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import './HeaderLanding.css';

interface NavLink {
  label: string;
  href: string;
  ariaLabel: string;
}

interface NavItem {
  label: string;
  bgColor: string;
  textColor: string;
  links: NavLink[];
}

// All cards now white like the first one
const navItems: NavItem[] = [
  {
    label: 'About',
    bgColor: 'hsl(var(--card))',
    textColor: 'hsl(var(--card-foreground))',
    links: [
      { label: 'Company', href: '/about/company', ariaLabel: 'About Company' },
      { label: 'Team', href: '/about/team', ariaLabel: 'About Team' },
      { label: 'Mission', href: '/about/mission', ariaLabel: 'Our Mission' },
    ],
  },
  {
    label: 'Benefits',
    bgColor: 'hsl(var(--card))',
    textColor: 'hsl(var(--card-foreground))',
    links: [
      { label: 'Features', href: '/benefits/features', ariaLabel: 'Platform Features' },
      { label: 'Pricing', href: '/benefits/pricing', ariaLabel: 'Pricing Plans' },
      { label: 'ROI Calculator', href: '/benefits/roi', ariaLabel: 'ROI Calculator' },
    ],
  },
  {
    label: 'Community',
    bgColor: 'hsl(var(--card))',
    textColor: 'hsl(var(--card-foreground))',
    links: [
      { label: 'Discord', href: '/community/discord', ariaLabel: 'Join Discord' },
      { label: 'Forum', href: '/community/forum', ariaLabel: 'Community Forum' },
      { label: 'Events', href: '/community/events', ariaLabel: 'Community Events' },
    ],
  },
];

export default function HeaderLanding() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { locale } = useParams();

  useEffect(() => setMounted(true), []);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content') as HTMLElement;
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';

        void contentEl.offsetHeight; // Force reflow

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return 260;
  };

  const createTimeline = useCallback(() => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease: 'power3.out',
    });

    tl.to(
      cardsRef.current,
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
        stagger: 0.08,
      },
      '-=0.1'
    );

    return tl;
  }, []);

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [createTimeline, navItems]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded, createTimeline]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;

    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className="card-nav-container">
      <nav
        ref={navRef}
        className={cn('card-nav', isExpanded && 'open')}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Top bar with logo, hamburger, and CTA */}
        <div className="card-nav-top">
          <div
            className={cn('hamburger-menu hidden md:block', isHamburgerOpen && 'open')}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMenu();
              }
            }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div className="logo-container">
            <Link href="/" className="logo-link">
              <span className="logo-text">Akkuea</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 h-full">
            <div className="flex items-center gap-4">
              {mounted && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (theme === 'light') setTheme('dark');
                          else if (theme === 'dark') setTheme('system');
                          else setTheme('light');
                        }}
                        className="p-2 z-30 hover:bg-muted/50 rounded-full transition-colors"
                      >
                        {theme === 'system' ? (
                          <Monitor className="h-5 w-5 text-muted" />
                        ) : resolvedTheme === 'dark' ? (
                          <Moon className="h-5 w-5 text-primary" />
                        ) : (
                          <Sun className="h-5 w-5 text-achievement" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>
                        {theme === 'light'
                          ? 'Switch to dark mode'
                          : theme === 'dark'
                            ? 'Switch to system theme'
                            : 'Switch to light mode'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Link href={`/${locale}`} className="card-nav-cta-button">
              Get Started
            </Link>
          </div>
        </div>

        {/* Theme Toggle */}

        {/* Expandable content with navigation cards */}
        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {navItems.map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {item.links?.map((link, i) => (
                  <Link
                    key={`${link.label}-${i}`}
                    href={link.href}
                    className={cn('nav-card-link', pathname === link.href && 'active')}
                    aria-label={link.ariaLabel}
                  >
                    <ArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
