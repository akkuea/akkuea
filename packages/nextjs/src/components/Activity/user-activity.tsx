'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import TabNavigation from './user-dashboard/tab-navigation';
import TabContent from './user-dashboard/tab-content';
import { generateHeatmapData } from '@/lib/utils';

// Activity type definition
interface Activity {
  id: number;
  type: 'comment' | 'like' | 'post' | 'achievement' | 'join';
  content: string;
  timeAgo: string;
}

const UserActivityDashboard = () => {
  const [activeTab, setActiveTab] = useState('Activity');
  const tabs = ['Activity', 'Achievements', 'Statistics'];

  // Generate data but only use it in the component when needed
  generateHeatmapData();

  // Sample recent activity data
  const recentActivity: Activity[] = [
    {
      id: 1,
      type: 'comment',
      content: "Commented on 'Introduction to Functional Programming'",
      timeAgo: 'Today',
    },
    {
      id: 2,
      type: 'like',
      content: "Liked 'Data Visualization with D3.js'",
      timeAgo: 'Yesterday',
    },
    {
      id: 3,
      type: 'post',
      content: "Posted 'Advanced Machine Learning Techniques'",
      timeAgo: '2 days ago',
    },
    {
      id: 4,
      type: 'achievement',
      content: "Earned the 'Frequent Contributor' achievement",
      timeAgo: '3 days ago',
    },
    {
      id: 5,
      type: 'join',
      content: "Joined the 'Web Development' community",
      timeAgo: '5 days ago',
    },
  ];

  return (
    <div className="container bg-card rounded-lg shadow mx-auto mb-10 transition-colors duration-300 border border-border">
      {/* Header with title */}
      <div className="flex items-center mb-4 text-primary bg-primary/5 h-[55.99px] px-3">
        <Calendar size={18} className="mr-2" />
        <h1 className="text-lg font-bold">User Activity</h1>
      </div>
      <div className="p-4">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <TabContent activeTab={activeTab} recentActivity={recentActivity} />
      </div>
    </div>
  );
};

export default UserActivityDashboard;
