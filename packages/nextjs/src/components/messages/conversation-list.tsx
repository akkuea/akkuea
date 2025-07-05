import { useMessages } from '@/store/messaging-store';
import { ConversationItem } from './conversation-item';
import { ConversationListProps } from '@/app/Types/messages';

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const { conversations, selectConversation } = useMessages();

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    onSelectConversation();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-semibold text-[#00CECE]">Messages</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-0.5">
          {conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onSelect={() => handleSelectConversation(conversation.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
