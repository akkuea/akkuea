import ReactTooltip from 'react-tooltip'; // ✅ v4 tooltip import
import { cn } from '@/lib/utils';
import { useMessages } from '@/store/messaging-store';
import type { ConversationItemProps } from '@/app/Types/messages';

import { Avatar } from './Avatar';

export function ConversationItem({ conversation, onSelect }: ConversationItemProps) {
  const { selectedConversationId } = useMessages();

  return (
    <>
      <button
        onClick={onSelect}
        className={cn(
          'w-full p-4 text-left transition-colors hover:bg-gray-100',
          selectedConversationId === conversation.id && 'bg-gray-100'
        )}
        data-tip={`Chat with ${conversation.name}`} // ✅ added tooltip
      >
        <div className="flex items-center space-x-3">
          <Avatar name={conversation.name} imageUrl={conversation.avatar} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{conversation.name}</span>
              <span className="text-xs text-gray-500">{conversation.timestamp}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 truncate">
                {conversation.isTyping ? (
                  <span className="text-[#00CECE]">Typing...</span>
                ) : conversation.messages.length > 0 ? (
                  conversation.lastMessage
                ) : (
                  <span className="italic">No messages yet</span>
                )}
              </span>
              {conversation.unread && <span className="w-2 h-2 bg-[#00CECE] rounded-full" />}
            </div>
          </div>
        </div>
      </button>
      <ReactTooltip place="top" effect="solid" /> {/* ✅ global tooltip */}
    </>
  );
}
