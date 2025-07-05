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

// Simulated API response types
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

// Simulated API data
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLElement>(null);
  const trendingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedState = localStorage.getItem('rightSidebarState');
    if (savedState) {
      setIsCollapsed(JSON.parse(savedState));
    }

    const fetchData = async () => {
      setRecommendations(mockRecommendations);
      setTrending(mockTrending);
    };

    fetchData();
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('rightSidebarState', JSON.stringify(newState));
  };

  const scrollToSection = (section: 'recommendations' | 'trending') => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setTimeout(() => {
        const targetRef = section === 'recommendations' ? recommendationsRef : trendingRef;
        if (targetRef.current && contentRef.current) {
          const containerTop = contentRef.current.getBoundingClientRect().top;
          const targetTop = targetRef.current.getBoundingClientRect().top;
          const scrollOffset = targetTop - containerTop;

          contentRef.current.scrollTo({
            top: scrollOffset,
            behavior: 'smooth',
          });
        }
      }, 300);
    } else {
      const targetRef = section === 'recommendations' ? recommendationsRef : trendingRef;
      if (targetRef.current && contentRef.current) {
        const containerTop = contentRef.current.getBoundingClientRect().top;
        const targetTop = targetRef.current.getBoundingClientRect().top;
        const scrollOffset = targetTop - containerTop;

        contentRef.current.scrollTo({
          top: scrollOffset,
          behavior: 'smooth',
        });
      }
    }
  };

  return (
    <aside
      className={`fixed right-0 top-14 h-[calc(100vh-3.5rem)] bg-white dark:bg-[#000000] dark:border-gray-600 border-l shadow-lg dark:shadow-gray-900/30
        transition-all duration-300 ease-in-out 
        ${isCollapsed ? 'w-16' : 'w-[256px]'}
        transform md:translate-x-0
        ${isCollapsed ? 'translate-x-full md:translate-x-0' : 'translate-x-0'}`}
    >
      <button
        onClick={toggleSidebar}
        className="absolute -left-3 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-full p-1.5 
          shadow-lg dark:shadow-gray-900/30 z-50 
          hover:bg-gray-50 dark:hover:bg-gray-800 
          transition-colors"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronLeft className="text-gray-600 dark:text-gray-400" size={16} />
        ) : (
          <ChevronRight className="text-gray-600 dark:text-gray-400" size={16} />
        )}
      </button>

      {isCollapsed ? (
        // Collapsed State
        <div className="h-full py-4">
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#0D9488]/10 dark:bg-[#0D9488]/20 flex items-center justify-center">
              <Compass className="w-5 h-5 text-[#0D9488] dark:text-[#0D9488]" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <div className="flex justify-center">
                <div
                  onClick={() => scrollToSection('recommendations')}
                  className="w-10 h-10 rounded-lg hover:bg-[#0D9488]/10 dark:hover:bg-[#0D9488]/20 
                    flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-[#0D9488] dark:text-[#0D9488]" />
                </div>
              </div>
              <div
                className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 
                bg-gray-900 dark:bg-gray-800 text-white text-xs rounded 
                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
              >
                Recommendations
              </div>
            </div>

            <div className="relative group">
              <div className="flex justify-center">
                <div
                  onClick={() => scrollToSection('trending')}
                  className="w-10 h-10 rounded-lg hover:bg-[#0D9488]/10 dark:hover:bg-[#0D9488]/20 
                    flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Flame className="w-5 h-5 text-[#0D9488] dark:text-[#0D9488]" />
                </div>
              </div>
              <div
                className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 
                bg-gray-900 dark:bg-gray-800 text-white text-xs rounded 
                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
              >
                Trending
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Expanded State
        <div className="h-full flex flex-col">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-[#0D9488] dark:text-white">Discovery</h2>
          </div>

          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto px-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div className="space-y-6">
              {/* Recommendations Section */}
              <section ref={recommendationsRef}>
                <h3 className="flex items-center gap-2 text-sm font-medium text-[#0D9488] dark:text-white mb-4">
                  <Sparkles size={16} className="text-[#0D9488] dark:text-[#0D9488]" />
                  Recommendations
                </h3>

                <div className="space-y-3">
                  {recommendations.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 
                        hover:border-[#0D9488]/20 dark:hover:border-[#0D9488]/40 
                        bg-white dark:bg-gray-700 group
                        hover:bg-[#0D9488]/5 dark:hover:bg-[#0D9488]/10
                        transform hover:scale-[1.02] hover:shadow-sm
                        transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-sm 
                          bg-[#0D9488]/10 dark:bg-[#0D9488]/20 
                          text-[#0D9488] dark:text-[#0D9488]"
                        >
                          {item.type}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {item.relevance}% relevant
                        </span>
                      </div>
                      <h4
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 
                        group-hover:text-[#0D9488] dark:group-hover:text-[#0D9488] transition-colors"
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 
                          flex items-center justify-center"
                        >
                          <User size={12} className="text-gray-500 dark:text-gray-400" />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.author}
                        </span>
                      </div>
                    </div>
                  ))}

                  <button
                    className="text-sm text-[#0D9488] dark:text-[#0D9488] 
                    hover:text-[#0D9488]/80 dark:hover:text-[#0D9488]/80 font-medium"
                  >
                    See more recommendations →
                  </button>
                </div>
              </section>

              {/* Trending Section */}
              <section ref={trendingRef}>
                <h3 className="flex items-center gap-2 text-sm font-medium text-[#0D9488] dark:text-white mb-4">
                  <Flame size={16} className="text-[#0D9488] dark:text-white" />
                  Trending
                </h3>

                <div className="space-y-3">
                  {trending.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 
                        hover:border-[#0D9488]/20 dark:hover:border-[#0D9488]/40 
                        bg-white dark:bg-gray-700 group
                        hover:bg-[#0D9488]/5 dark:hover:bg-[#0D9488]/10
                        transform hover:scale-[1.02] hover:shadow-sm
                        transition-all duration-200 cursor-pointer"
                    >
                      <h4
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 
                        group-hover:text-[#0D9488] dark:group-hover:text-[#0D9488] transition-colors"
                      >
                        {item.title}
                      </h4>
                      <div className="flex justify-between items-center">
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-sm 
                          bg-[#0D9488]/10 dark:bg-[#0D9488]/20 
                          text-[#0D9488] dark:text-[#0D9488]"
                        >
                          {item.category}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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
                    </div>
                  ))}

                  <button
                    className="text-sm text-[#0D9488] dark:text-[#0D9488] 
                    hover:text-[#0D9488]/80 dark:hover:text-[#0D9488]/80 font-medium"
                  >
                    See more trending topics →
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
