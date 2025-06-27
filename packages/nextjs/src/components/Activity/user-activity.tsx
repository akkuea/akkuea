'use client';

import { useState } from 'react';
import AnnualContributions from './annual-contributions-heatmap';
import { Calendar, Clock, MessageSquare, ThumbsUp, FileText, Award, Users } from 'lucide-react';

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

  // Generate sample heatmap data
  const generateHeatmapData = () => {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months.map((month) => ({
      month,
      days: Array(7)
        .fill(0)
        .map(() =>
          Array(4)
            .fill(0)
            .map(() => Math.floor(Math.random() * 5))
        ),
    }));
  };

  // Generate data but only use it in the component when needed
  generateHeatmapData();

  // Sample recent activity data
  const recentActivity = [
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

  // Activity color function is handled in the AnnualContributions component

  // Helper function to get icon for activity type
  const getActivityIcon = (type: Activity['type'] | string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare size={16} className="text-teal-400" />;
      case 'like':
        return <ThumbsUp size={16} className="text-teal-400" />;
      case 'post':
        return <FileText size={16} className="text-teal-400" />;
      case 'achievement':
        return <Award size={16} className="text-teal-400" />;
      case 'join':
        return <Users size={16} className="text-teal-400" />;
      default:
        return <Clock size={16} className="text-teal-400" />;
    }
  };

  return (
    <div className="container bg-white dark:bg-black rounded-lg shadow mx-auto mb-10 transition-colors duration-300 border">
      {/* Header with title */}
      <div className="flex items-center mb-4 text-teal-600 dark:text-teal-400 bg-[#00CED10D] dark:bg-teal-900/20 h-[55.99px] px-3">
        <Calendar size={18} className="mr-2" />
        <h1 className="text-lg font-bold">User Activity</h1>
      </div>

      <div className="p-4">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-4 transition-colors duration-300">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-300 ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-600 text-teal-600 dark:text-teal-300 shadow'
                  : 'text-gray-600 dark:text-gray-300 hover:text-teal-500 dark:hover:text-teal-400'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content based on active tab */}
        {activeTab === 'Activity' && (
          <>
            {/* Annual Contributions Heatmap */}
            <AnnualContributions />

            {/* Recent Activity List */}
            <div className="mt-6">
              <h2 className="text-base font-medium mb-3 text-gray-800 dark:text-gray-200">
                Recent Activity
              </h2>
              <div className="border rounded-xl px-4 py-6 dark:border-gray-700 transition-colors duration-300">
                <div className="flex flex-col space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start">
                      <div className="mt-1 p-1 bg-teal-100 dark:bg-teal-900/30 bg-opacity-20 rounded">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {activity.content}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {activity.timeAgo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <button className="text-sm text-teal-400 hover:text-teal-500 dark:hover:text-teal-300">
                    View all activity history
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'Achievements' && (
          <div className="h-52 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Achievements content would go here
          </div>
        )}

        {activeTab === 'Statistics' && (
          <div className="h-52 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Statistics content would go here
          </div>
        )}
      </div>
    </div>
  );
};

export default UserActivityDashboard; 