import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle } from 'lucide-react';
import ReactTooltip from 'react-tooltip'; // v4 import

interface Discussion {
  id: number;
  title: string;
  author: string;
  community: string;
  timestamp: string;
  comments: number;
  unread: boolean;
  avatar: string;
}

interface DiscussionItemProps {
  discussion: Discussion;
}

export default function DiscussionItem({ discussion }: DiscussionItemProps) {
  return (
    <>
      <Card className="hover:shadow-sm transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar with tooltip */}
            <Avatar
              className="w-8 h-8 flex-shrink-0"
              data-tip={`Author: ${discussion.author}`}
            >
              <AvatarImage src={discussion.avatar || '/placeholder.svg'} alt={discussion.author} />
              <AvatarFallback>
                {discussion.author
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {discussion.unread && (
                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                )}
                <h3 className="font-medium text-foreground line-clamp-1">{discussion.title}</h3>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted mb-2">
                <span className="font-medium text-foreground">{discussion.author}</span>
                <span>in</span>
                <span className="font-medium text-primary">{discussion.community}</span>
                <span>•</span>
                <span>{discussion.timestamp}</span>
              </div>

              {/* Comments with tooltip */}
              <div
                className="flex items-center gap-1 text-sm text-muted"
                data-tip={`${discussion.comments} comments`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>{discussion.comments} comments</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Single ReactTooltip instance for v4 */}
      <ReactTooltip place="top" effect="solid" />
    </>
  );
}
