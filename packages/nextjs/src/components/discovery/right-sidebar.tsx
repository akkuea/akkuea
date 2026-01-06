'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  MessageSquare,
  Share2,
  User,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types for API response data
interface RecommendationItem {
  id: string;
  type: 'Article' | 'Tutorial';
  relevance: number;
  title: string;
  author: string;
}

interface TrendingItem {
  id: string;
  title: string;
  category: string;
  comments: number;
  shares: number;
}

// Mock data for demonstration
const mockRecommendations: RecommendationItem[] = [
  {
    id: '1',
    type: 'Article',
    relevance: 98,
    title: 'Introduction to Functional Programming',
    author: 'Kim Cascante',
  },
  {
    id: '2',
    type: 'Tutorial',
    relevance: 92,
    title: 'Data Visualization with D3.js',
    author: 'Carlos Rodriguez',
  },
  {
    id: '3',
    type: 'Article',
    relevance: 89,
    title: 'Machine Learning Fundamentals',
    author: 'Ana López',
  },
];

const mockTrending: TrendingItem[] = [
  {
    id: '1',
    title: 'How AI is Transforming Education',
    category: 'Technology',
    comments: 156,
    shares: 89,
  },
  {
    id: '2',
    title: 'Complete Guide to React Hooks',
    category: 'Programming',
    comments: 124,
    shares: 76,
  },
  {
    id: '3',
    title: 'Neuroscience-based Study Techniques',
    category: 'Education',
    comments: 98,
    shares: 112,
  },
];

export default function RightSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if desktop (>= 768px) and load saved state
    const isDesktop = window.innerWidth >= 768;
    if (isDesktop) {
      const savedState = localStorage.getItem('rightSidebarState');
      if (savedState) {
        setIsCollapsed(JSON.parse(savedState));
      } else {
        setIsCollapsed(false); // Default expanded on desktop
      }
    } else {
      setIsCollapsed(true); // Always collapsed on mobile
    }

    // Simulate API data fetch
    const fetchData = async () => {
      setRecommendations(mockRecommendations);
      setTrending(mockTrending);
    };
    fetchData();

    // Handle window resize
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Only save state on desktop
    if (window.innerWidth >= 768) {
      localStorage.setItem('rightSidebarState', JSON.stringify(newState));
    }
  };

  const scrollToTab = (tab: 'recommendations' | 'trending') => {
    if (isCollapsed) {
      setIsCollapsed(false);
      // Allow time for expand animation then scroll
      setTimeout(() => {
        const tabTrigger = document.querySelector(`[data-value="${tab}"]`) as HTMLElement;
        tabTrigger?.click();
      }, 300);
    } else {
      const tabTrigger = document.querySelector(`[data-value="${tab}"]`) as HTMLElement;
      tabTrigger?.click();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:sticky right-0 top-14 h-[calc(100vh-3.5rem)] bg-sidebar text-sidebar-foreground border-l border-sidebar-border shadow-lg transition-all duration-300 ease-in-out z-40 flex-shrink-0
          ${isCollapsed ? 'w-0 md:w-16' : 'w-full md:w-64'}
          ${isCollapsed ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}
      >
        {/* Toggle Button - Fixed position on mobile */}
        <Button
          onClick={toggleSidebar}
          variant="outline"
          size="icon"
          className={`absolute top-4 bg-sidebar rounded-full p-1.5 shadow-lg z-50 hover:bg-sidebar-accent transition-all border-sidebar-border h-10 w-10
            ${isCollapsed ? 'fixed right-4 md:absolute md:-left-3 md:top-1/2 md:-translate-y-1/2' : 'right-4 md:-left-3 md:top-1/2 md:-translate-y-1/2'}
          `}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronLeft className="text-sidebar-foreground" size={20} />
          ) : (
            <ChevronRight className="text-sidebar-foreground" size={20} />
          )}
        </Button>

        {isCollapsed ? (
          // Collapsed State - Icon Navigation (hidden on mobile)
          <div className="hidden md:block h-full py-4">
            <div className="flex justify-center mb-6">
              <div className="bg-primary rounded-[8px] h-8 w-8 flex items-center justify-center">
                <Compass className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="space-y-4 px-2">
              <div className="relative group">
                <div className="flex justify-center">
                  <div
                    onClick={() => scrollToTab('recommendations')}
                    className="bg-primary rounded-[8px] h-8 w-8 flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-border shadow-lg">
                  Recommendations
                </div>
              </div>
              <div className="relative group">
                <div className="flex justify-center">
                  <div
                    onClick={() => scrollToTab('trending')}
                    className="bg-primary rounded-[8px] h-8 w-8 flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    <Flame className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-border shadow-lg">
                  Trending
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Expanded State - Full Content
          <div className="h-full flex flex-col pt-16 md:pt-0">
            <div className="p-4 md:p-4 border-b border-sidebar-border">
              <h2 className="text-lg md:text-lg font-semibold text-primary flex items-center gap-2">
                <Compass className="w-5 h-5" />
                Discovery
              </h2>
            </div>

            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto p-4 md:p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <Tabs defaultValue="recommendations" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                  <TabsTrigger value="recommendations" className="text-xs md:text-xs">
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">For You</span>
                    <span className="sm:hidden">You</span>
                  </TabsTrigger>
                  <TabsTrigger value="trending" className="text-xs md:text-xs">
                    <Flame className="w-4 h-4 mr-1.5" />
                    Trending
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="recommendations" className="space-y-4">
                  <div className="space-y-3">
                    {recommendations.map((item) => (
                      <Card
                        key={item.id}
                        className="hover:shadow-md transition-all duration-200 cursor-pointer group border-border/50 hover:border-primary/20"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center mb-2">
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              {item.type}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                              {item.relevance}% match
                            </Badge>
                          </div>
                          <CardTitle className="text-sm font-medium text-card-foreground group-hover:text-primary transition-colors leading-tight">
                            {item.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                              <User size={12} className="text-muted-foreground" />
                            </div>
                            <span className="text-xs text-muted-foreground">{item.author}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-primary hover:text-primary/80 font-medium justify-start p-0"
                  >
                    See more recommendations →
                  </Button>
                </TabsContent>

                <TabsContent value="trending" className="space-y-4">
                  <div className="space-y-3">
                    {trending.map((item) => (
                      <Card
                        key={item.id}
                        className="hover:shadow-md transition-all duration-200 cursor-pointer group border-border/50 hover:border-primary/20"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-card-foreground group-hover:text-primary transition-colors leading-tight">
                            {item.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                          <div className="flex justify-between items-center">
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              {item.category}
                            </Badge>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                <span>{item.comments}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Share2 size={12} />
                                <span>{item.shares}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-primary hover:text-primary/80 font-medium justify-start p-0"
                  >
                    See more trending topics →
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
