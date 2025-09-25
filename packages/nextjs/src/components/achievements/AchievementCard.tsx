import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Achievement } from '@/lib/types';
import ReactTooltip from 'react-tooltip';

const categoryStyles: { [key: string]: string } = {
  Contribution: 'bg-contribution-bg/20 text-contribution-text border-contribution-border/30',
  Community: 'bg-community-bg/20 text-community-text border-community-border/30',
  Learning: 'bg-learning-bg/20 text-learning-text border-learning-border/30',
  Impact: 'bg-impact-bg/20 text-impact-text border-impact-border/30',
};

const iconBgStyles: { [key: string]: string } = {
  completed: 'bg-primary',
  'in-progress': 'bg-primary/30',
  locked: 'bg-primary/30',
};

export const AchievementCard = ({ achievement }: { achievement: Achievement }) => {
  const badgeStyle =
    categoryStyles[achievement.category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const iconBgStyle = iconBgStyles[achievement.status];

  return (
    <div className="bg-card rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
      {/* Status Icon */}
      <div
        data-tip={
          achievement.status === 'completed'
            ? 'This achievement is completed'
            : achievement.status === 'in-progress'
            ? 'Keep going, you are making progress!'
            : 'This achievement is locked'
        }
      >
        <div className={`${iconBgStyle} p-3 rounded-lg`}>
          <achievement.icon className="w-6 h-6 text-card" />
        </div>
      </div>

      <div className="flex flex-col w-full text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-2">
          <h3 className=" text-foreground font-semibold text-base">{achievement.title}</h3>

          {/* Badge with tooltip */}
          <div data-tip={`Category: ${achievement.category}`}>
            <Badge className={`${badgeStyle} mt-2 sm:mt-0`}>
              {achievement.category}
            </Badge>
          </div>
        </div>

        <p className="text-muted text-sm">{achievement.description}</p>
        <div className="flex flex-col gap-1 mt-4">
          <div className="flex justify-between">
            {achievement.status === 'completed' && (
              <p className="text-foreground text-sm">
                Completed on {achievement.completedDate}
              </p>
            )}
            {achievement.status === 'in-progress' && (
              <p className="text-foreground text-sm">
                In progress - {achievement.progressText}
              </p>
            )}
            {achievement.status !== 'locked' && (
              <span className="text-foreground font-semibold text-sm">{achievement.progress}%</span>
            )}
          </div>

          {/* Progress bar with tooltip */}
          {achievement.status !== 'locked' && (
            <div
              className="flex items-center justify-between"
              data-tip={`Progress: ${achievement.progress}%`}
            >
              <Progress value={achievement.progress} className="flex-1 " />
            </div>
          )}
        </div>
      </div>

      {/* ReactTooltip Component */}
      <ReactTooltip place="top" type="dark" effect="solid" />
    </div>
  );
};
