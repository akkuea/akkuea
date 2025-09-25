'use client';
import { Edit } from 'lucide-react';
import UserActivityDashboard from '@/components/Activity/user-activity';
import PublicationMain from '@/components/publication/publication-main';
import Link from 'next/link';
import ReactTooltip from "react-tooltip"
import 'react-tooltip/dist/react-tooltip.css';

const ProfilePage = () => {
  return (
    <div className="bg-background container md:mx-auto shadow-sm p-6 transition-colors duration-300">
      <div className="flex flex-col md:flex-row items-start gap-6 md:pt-7 md:pl-10 container mx-auto rounded-lg py-8 px-4 border border-border">
        <div className="w-full md:w-auto flex flex-col items-center justify-between md:items-start md:h-[270px] pt-6">
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full ring-4 ring-card bg-gradient-to-br from-card to-muted/20 flex items-center justify-center overflow-hidden shadow-lg">
            <svg
              className="w-16 h-16 md:w-20 md:h-20 text-muted transition-transform hover:scale-110 duration-300"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>

        <div className="flex-1 pt-2 w-full mx-3">
          {/* username */}
          <div className="border-b pb-4 border-border">
            <div className="flex flex-col justify-between sm:flex-row sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground hover:text-primary transition-colors duration-200">
                  Jefferson Calderon
                </h1>
                <div className="text-muted font-normal">@xJeffx23</div>
              </div>
              <Link
                href="/edit-profile"
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-card/50 transition-all duration-200 hover:shadow-sm flex items-center gap-2 text-foreground"
                data-tip="Edit your profile information"
              >
                <Edit size={16} />
                Edit Profile
              </Link>
              <ReactTooltip place="top" effect="solid" />
            </div>
            <p className="text-foreground leading-relaxed mb-4 md:w-1/2">
              I am a crack designer, I like software engineering and also mixing as a DJ. Passionate
              about creating beautiful and functional digital experiences.
            </p>
            <div className="flex gap-2 mt-4">
              <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium hover:bg-primary/20 transition-colors duration-200">
                Student
              </span>
              <span className="px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-sm font-medium hover:bg-secondary/20 transition-colors duration-200">
                Designer
              </span>
            </div>
          </div>

          {/* following */}
          <div className="flex flex-row gap-8 my-4 border-b py-3 border-border">
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-foreground">15</span>
              <span className="text-muted text-sm">posts</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-foreground">1,234</span>
              <span className="text-muted text-sm">followers</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-foreground">567</span>
              <span className="text-muted text-sm">following</span>
            </div>
          </div>
          <p className="font-normal text-muted mb-2">National University of Design</p>
          <span className="text-primary font-normal mt-5">
            &quot;Creating the future through design and technology&quot;
          </span>
        </div>
      </div>
      <PublicationMain />
      <UserActivityDashboard />
    </div>
  );
};

export default ProfilePage;
