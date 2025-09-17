import { Trophy, Award } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { achievements } from '@/lib/achievements-data';
import { AchievementList } from '@/components/achievements/AchievementList';

export default function Component() {
  const completedAchievements = achievements.filter((a) => a.status === 'completed');
  const inProgressAchievements = achievements.filter((a) => a.status === 'in-progress');
  const lockedAchievements = achievements.filter((a) => a.status === 'locked');

  return (
    <>
      <div className="min-h-screen bg-background text-card p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Award className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Achievements</h1>
          </div>

          <article className="bg-card w-full p-5 rounded-md space-y-5">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
              <div className="text-center lg:text-left">
                <h2 className="text-lg sm:text-xl font-semibold text-primary">Your progress</h2>
                <div className="flex items-center justify-center lg:justify-start space-x-2 text-slate-300 text-sm">
                  <Trophy className="w-5 h-5 text-primary" />
                  <span>You have completed 12 of 30 achievements</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-primary">12</div>
                  <div className="text-muted text-[11px] sm:text-xs">Completed achievements</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-primary">Intermediate</div>
                  <div className="text-muted text-[11px] sm:text-xs">Current level</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-primary">1,245</div>
                  <div className="text-muted text-[11px] sm:text-xs">Experience points</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-primary">#342</div>
                  <div className="text-muted text-[11px] sm:text-xs">Ranking position</div>
                </div>
              </div>
            </div>
            <div>
              <Progress value={40} className="w-full" />
            </div>
          </article>

          {/* Achievement Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-background">
              <TabsTrigger
                value="all"
                className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-card"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className=" text-foreground data-[state=active]:bg-primary data-[state=active]:text-card"
              >
                Completed
              </TabsTrigger>
              <TabsTrigger
                value="in-progress"
                className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-card"
              >
                In progress
              </TabsTrigger>
              <TabsTrigger
                value="locked"
                className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-card"
              >
                Locked
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <AchievementList achievements={achievements} />
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <AchievementList achievements={completedAchievements} />
            </TabsContent>

            <TabsContent value="in-progress" className="mt-6">
              <AchievementList achievements={inProgressAchievements} />
            </TabsContent>

            <TabsContent value="locked" className="mt-6">
              <AchievementList achievements={lockedAchievements} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
