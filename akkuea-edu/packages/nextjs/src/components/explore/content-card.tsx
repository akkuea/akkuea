import type React from 'react';
import { User, Heart, MessageCircle } from 'lucide-react';

type ContentCardProps = {
  type: 'trending' | 'featured';
  item: {
    author: string;
    readTime?: string;
    title: string;
    topic?: string;
    likes: number;
    comments: number;
    specialty?: string;
  };
};

const ContentCard: React.FC<ContentCardProps> = ({ type, item }) => {
  return (
    <div className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow mt-6">
      {type === 'trending' ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-muted/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-muted" />
            </div>
            <div>
              <div className="font-medium text-foreground">{item.author}</div>
              <div className="text-sm text-muted">{item.readTime}</div>
            </div>
          </div>
          <h3 className="font-semibold text-foreground mb-4 leading-tight">{item.title}</h3>
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
              {item.topic}
            </span>
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="flex items-center gap-1">
                <Heart className="w-4 h-4" />
                <span>{item.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                <span>{item.comments}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start flex-col justify-between mb-4">
            <div className="flex flex-row justify-between items-center w-full">
              <h3 className="font-semibold text-foreground mb-2 text-lg">{item.title}</h3>
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                Featured
              </span>
            </div>
            <div className="flex flex-row justify-between items-center w-full mt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted/20 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-muted" />
                </div>
                <div>
                  <div className="font-medium text-foreground">{item.author}</div>
                  <div className="text-sm text-muted">{item.specialty}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted">
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span>{item.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{item.comments}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContentCard;
