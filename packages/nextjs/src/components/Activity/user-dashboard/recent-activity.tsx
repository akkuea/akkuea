import { MessageSquare, Clock, ThumbsUp, FileText, Award, Users } from 'lucide-react';
import ReactTooltip from 'react-tooltip';

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
        return <MessageSquare size={16} className="text-primary" />;
      case 'like':
        return <ThumbsUp size={16} className="text-primary" />;
      case 'post':
        return <FileText size={16} className="text-primary" />;
      case 'achievement':
        return <Award size={16} className="text-primary" />;
      case 'join':
        return <Users size={16} className="text-primary" />;
      default:
        return <Clock size={16} className="text-primary" />;
    }
  };

  return (
    <div className="mt-6">
      <h2 className="text-base font-medium mb-3 text-foreground">Recent Activity</h2>
      <div className="border border-border rounded-xl px-4 py-6 transition-colors duration-300">
        <div className="flex flex-col space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start">
              <div className="mt-1 p-1 bg-primary/10 rounded">{getActivityIcon(activity.type)}</div>
              <div className="ml-3">
                <p className="text-sm text-foreground">{activity.content}</p>
                <p className="text-xs text-muted">{activity.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-right">
          <button
            className="text-sm text-primary hover:text-primary/80 transition-colors"
            data-tip="See the complete activity history"
          >
            View all activity history
          </button>
        </div>
      </div>

      {/* ReactTooltip Component */}
      <ReactTooltip place="top" type="dark" effect="solid" />
    </div>
  );
};

export default RecentActivity;
