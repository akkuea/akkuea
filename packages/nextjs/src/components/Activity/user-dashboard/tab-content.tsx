import AnnualContributions from '../annual-contributions-heatmap';
import RecentActivity from './recent-activity';

// Activity type definition
interface Activity {
  id: number;
  type: 'comment' | 'like' | 'post' | 'achievement' | 'join';
  content: string;
  timeAgo: string;
}

interface TabContentProps {
  activeTab: string;
  recentActivity: Activity[];
}

const TabContent = ({ activeTab, recentActivity }: TabContentProps) => {
  if (activeTab === 'Activity') {
    return (
      <>
        {/* Annual Contributions Heatmap */}
        <AnnualContributions />

        {/* Recent Activity List */}
        <RecentActivity activities={recentActivity} />
      </>
    );
  }

  if (activeTab === 'Achievements') {
    return (
      <div className="h-52 flex items-center justify-center text-muted">
        Achievements content would go here
      </div>
    );
  }

  if (activeTab === 'Statistics') {
    return (
      <div className="h-52 flex items-center justify-center text-muted">
        Statistics content would go here
      </div>
    );
  }

  return null;
};

export default TabContent;
