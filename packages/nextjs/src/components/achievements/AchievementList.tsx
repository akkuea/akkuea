import { Achievement } from '@/lib/types';

import { AchievementCard } from './AchievementCard';

export const AchievementList = ({ achievements }: { achievements: Achievement[] }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {achievements.map((achievement) => (
      <AchievementCard key={achievement.id} achievement={achievement} />
    ))}
  </div>
);
