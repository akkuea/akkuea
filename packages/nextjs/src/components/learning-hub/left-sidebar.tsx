'use client';

import { useState, useEffect } from 'react';
import {
  Home,
  Compass,
  Users,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  GraduationCap,
  Award,
  Sparkles,
  Lightbulb,
  ChartColumn,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function LeftSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const savedState = localStorage.getItem('leftSidebarState');
    if (savedState) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('leftSidebarState', JSON.stringify(newState));
  };

  const sidebarItems = {
    icon: GraduationCap,
    title: 'Learning Hub',
    items: [
      {
        icon: Home,
        label: 'Home',
        description: 'Your learning feed',
        href: '/',
      },
      {
        icon: Compass,
        label: 'Explore',
        description: 'Discover new content',
        href: '/explore',
      },
      {
        icon: Users,
        label: 'Communities',
        description: 'Join study groups',
        href: '/communities',
      },
      {
        icon: Award,
        label: 'Achievements',
        description: 'Your learning progress',
        href: '/achievements',
      },
    ],
    metrics: {
      icon: Sparkles,
      title: 'Your Learning',
      description: 'Track your progress and set new learning goals',
      values: [
        {
          icon: Lightbulb,
          label: 'Skills',
          value: 5,
        },
        {
          icon: ChartColumn,
          label: 'Courses',
          value: 3,
        },
        {
          icon: Bookmark,
          label: 'Saved',
          value: 12,
        },
      ],
    },
  };

  return (
    <aside
      className={`fixed left-0 top-14 h-[calc(100vh-3.5rem)] bg-white dark:bg-[#000000] dark:border-gray-600 border-r shadow-lg 
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-[256px]'}
        transform md:translate-x-0
        ${isCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}
    >
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-transparent rounded-full p-1.5 shadow-lg z-50 hover:bg-gray-50 dark:hover:bg-gray-800"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="text-gray-600 dark:text-gray-400" size={16} />
        ) : (
          <ChevronLeft className="text-gray-600 dark:text-gray-400" size={16} />
        )}
      </button>

      <div className="p-4">
        <div className="flex items-center mb-8">
          <div className="flex items-center gap-2">
            <div
              className={`rounded-[8px] h-[40px] w-[40px] flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-[#00CED1] to-[#008B8B] ${isCollapsed ? 'h-8 w-8' : ''}`}
            >
              <sidebarItems.icon className="w-[23px] h-[23px] text-white" />
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
            >
              <h1 className="text-lg font-bold whitespace-nowrap bg-gradient-to-r from-[#00CED1] to-[#008B8B] bg-clip-text text-transparent">
                {sidebarItems.title}
              </h1>
            </div>
          </div>
        </div>

        <nav
          className={`space-y-1 transition-all duration-300 transform ${isCollapsed ? 'translate-x-[0.25rem]' : 'translate-x-0'}`}
        >
          {sidebarItems.items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link href={item.href} key={item.href}>
                <div
                  className={`flex items-center rounded-lg cursor-pointer transition-all duration-200
                  ${isCollapsed ? 'p-2 justify-center' : 'p-3 gap-2'}
                  ${
                    isActive
                      ? 'bg-[#0D9488]/10 dark:bg-[#0D9488]/20'
                      : 'bg-white dark:bg-transparent hover:bg-[#0D9488]/5 dark:hover:bg-[#0D9488]/10'
                  }
                  transform hover:scale-[1.02] hover:shadow-sm`}
                >
                  <div
                    className={`bg-[#0D9488]  ${isActive ?"dark:bg-[#0D9488]":"dark:bg-gray-500"} rounded-[8px] h-9 w-9 flex items-center justify-center flex-shrink-0 ${isCollapsed ? 'h-8 w-8' : ''}`}
                  >
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <div
                    className={`flex flex-col overflow-hidden transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
                  >
                    <span className={`text-[16px] font-medium ${isActive?"dark:text-[#0D9488]": "dark:text-white"} text-[#0D9488]  whitespace-nowrap`}>
                      {item.label}
                    </span>
                    <span className="text-xs text-[#4B5563] dark:text-[#9CA3AF] whitespace-nowrap">
                      {item.description}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div
          className={`my-8 p-4 ${!isCollapsed ? 'mx-3 border border-gray-200 dark:border-gray-700' : ''}`}
        >
          <div
            className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'h-0 opacity-0 m-0' : 'h-auto opacity-100 mb-4'}`}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <sidebarItems.metrics.icon className="w-5 h-5 text-[#0D9488] dark:text-[#00CED1]" />
              <span className="text-base font-medium text-[#0D9488] dark:text-[#00CED1]">
                {sidebarItems.metrics.title}
              </span>
            </div>
            <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF] whitespace-nowrap">
              {sidebarItems.metrics.description}
            </p>
          </div>
          <div className={`flex ${isCollapsed ? 'flex-col space-y-4' : 'justify-between'} text-xs`}>
            {sidebarItems.metrics.values.map((metric) => (
              <div key={metric.label} className="flex flex-col items-center">
                <div className={`flex items-center ${isCollapsed ? 'gap-2' : 'flex-col gap-1'}`}>
                  <div className="flex items-center">
                    <metric.icon
                      className={`w-4 h-4 ${isCollapsed ? 'text-[#0D9488]' : 'text-gray-400'}`}
                    />
                    <span
                      className={`${isCollapsed ? 'text-[#0D9488] font-medium' : 'text-gray-500'}`}
                    >
                      {metric.value}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <span className="text-gray-500 whitespace-nowrap">
                      {metric.label.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

     
      </div>
    </aside>
  );
} 