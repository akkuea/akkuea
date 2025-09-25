import type React from 'react';
import { User } from 'lucide-react';
import ReactTooltip from 'react-tooltip'; // ✅ v4 tooltip import

interface Person {
  name: string;
  username: string;
  specialty: string;
  followers: number;
  posts: number;
}

interface PeopleCardProps {
  person: Person;
}

const PeopleCard: React.FC<PeopleCardProps> = ({ person }) => {
  return (
    <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow mt-6">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-muted/20 rounded-full mx-auto mb-3 flex items-center justify-center">
          <User className="w-8 h-8 text-muted" />
        </div>
        <h3 className="font-semibold text-foreground">{person.name}</h3>
        <p className="text-sm text-muted mb-1">{person.username}</p>
        <p className="text-sm text-primary font-medium">{person.specialty}</p>
      </div>
      <div className="flex justify-center gap-6 text-sm text-muted mb-4">
        <div className="text-center">
          <div className="font-semibold text-foreground">{person.followers.toLocaleString()}</div>
          <div>followers</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-foreground">{person.posts}</div>
          <div>posts</div>
        </div>
      </div>
      <button
        data-tip="Follow this user"
        className="w-full bg-primary hover:bg-primary/80 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Follow
      </button>
      <ReactTooltip place="bottom" effect="solid" /> {/* ✅ global tooltip */}
    </div>
  );
};

export default PeopleCard;
