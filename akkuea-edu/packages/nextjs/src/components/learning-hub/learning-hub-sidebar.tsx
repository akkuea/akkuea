'use client';

import {
  Home,
  Compass,
  Users,
  Bookmark,
  GraduationCap,
  Award,
  Sparkles,
  Lightbulb,
  BarChartIcon as ChartColumn,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

export default function LearningHubSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const sidebarItems = {
    icon: GraduationCap,
    title: 'Learning Hub',
    items: [
      {
        icon: Home,
        label: 'Home',
        description: 'Your learning feed',
        href: '/home',
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
    <Sidebar
      collapsible="icon"
      className="border-r sticky top-14 h-[calc(100vh-3.5rem)] overflow-visible"
      style={
        {
          '--sidebar-width': '20rem',
          '--sidebar-width-icon': '4rem',
        } as React.CSSProperties
      }
    >
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-card rounded-full p-1.5 shadow-lg z-[60] hover:bg-muted/50 "
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ right: '-12px' }}
      >
        {isCollapsed ? (
          <ChevronRight className="text-muted-foreground" size={16} />
        ) : (
          <ChevronLeft className="text-muted-foreground" size={16} />
        )}
      </button>
      <SidebarHeader className="p-4">
        <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
          <div
            className={`rounded-[8px] ${
              isCollapsed ? 'h-8 w-8' : 'h-[40px] w-[40px]'
            } flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-primary to-primary/80 transition-all duration-300`}
          >
            <sidebarItems.icon className="w-[23px] h-[23px] text-white" />
          </div>
          {!isCollapsed && (
            <h1 className="text-lg font-bold whitespace-nowrap bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              {sidebarItems.title}
            </h1>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent className={isCollapsed ? 'px-0' : ''}>
            <SidebarMenu>
              {sidebarItems.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={isCollapsed ? item.label : undefined}
                      size="lg"
                      className={`group relative h-auto py-3 ${
                        isActive ? 'bg-primary/10' : 'hover:bg-primary/5'
                      } transition-all duration-200 hover:scale-[1.02] ${
                        isCollapsed ? 'justify-center items-center w-full' : ''
                      }`}
                    >
                      <Link
                        href={item.href}
                        className={isCollapsed ? 'flex justify-center w-full' : ''}
                      >
                        <div
                          className={`bg-primary rounded-[8px] ${
                            isCollapsed ? 'h-8 w-8' : 'h-9 w-9'
                          } flex items-center justify-center flex-shrink-0`}
                        >
                          <item.icon className="w-5 h-5 text-white" />
                        </div>
                        {!isCollapsed && (
                          <div className="flex flex-col items-start ml-2">
                            <span
                              className={`text-[16px] font-medium ${
                                isActive ? 'text-primary' : 'text-foreground'
                              }`}
                            >
                              {item.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent className={`${isCollapsed ? 'px-0' : 'px-2'}`}>
            <div
              className={`my-4  rounded-lg ${isCollapsed ? 'p-2 mx-2' : 'p-4 border border-border'}`}
            >
              {!isCollapsed && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <sidebarItems.metrics.icon className="w-5 h-5 text-primary" />
                    <span className="text-base font-medium text-primary">
                      {sidebarItems.metrics.title}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {sidebarItems.metrics.description}
                  </p>
                </>
              )}
              <div
                className={`flex ${
                  isCollapsed ? 'flex-col space-y-4 justify-center items-center' : 'justify-between'
                } text-xs`}
              >
                {sidebarItems.metrics.values.map((metric) => (
                  <div
                    key={metric.label}
                    className={`flex flex-col items-center ${
                      isCollapsed ? 'justify-center w-full text-center' : ''
                    }`}
                  >
                    <div
                      className={`flex items-center ${
                        isCollapsed ? 'gap-2 justify-center w-full' : 'flex-col gap-1'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}
                      >
                        <metric.icon
                          className={`w-4 h-4 ${
                            isCollapsed ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                        <span
                          className={`${
                            isCollapsed ? 'text-primary font-medium' : 'text-muted-foreground'
                          }`}
                        >
                          {metric.value}
                        </span>
                      </div>
                      {!isCollapsed && (
                        <span className="text-muted-foreground">{metric.label.toLowerCase()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
