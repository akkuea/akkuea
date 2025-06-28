import { MessageSquare, Clock, ThumbsUp, FileText, Award, Users } from 'lucide-react';

// Activity type definition
interface Activity {
  id: number;
  type: 'comment' | 'like' | 'post' | 'achievement' | 'join';
  content: string;
  timeAgo: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const RecentActivity = ({ activities }: RecentActivityProps) => {
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
    <div className="mt-6">
      <h2 className="text-base font-medium mb-3 text-gray-800 dark:text-gray-200">
        Recent Activity
      </h2>
      <div className="border rounded-xl px-4 py-6 dark:border-gray-700 transition-colors duration-300">
        <div className="flex flex-col space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start">
              <div className="mt-1 p-1 bg-teal-100 dark:bg-teal-900/30 bg-opacity-20 rounded">
                {getActivityIcon(activity.type)}
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-800 dark:text-gray-200">{activity.content}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activity.timeAgo}</p>
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
  );
};

export default RecentActivity;
