import { useMessages } from '@/store/messaging-store';
import { Avatar } from './Avatar';

export function MessagePreview() {
  const { conversations } = useMessages();
  const unreadMessages = conversations.filter((conv) => conv.unread);

  if (unreadMessages.length === 0) {
    return <div className="p-2 text-sm text-gray-500">No new messages</div>;
  }

  return (
    <div className="w-64 max-h-80 overflow-y-auto">
      <div className="p-2">
        <h3 className="text-sm font-semibold mb-2">Unread messages</h3>
        <div className="space-y-2">
          {unreadMessages.slice(0, 3).map((conversation) => (
            <div key={conversation.id} className="flex items-start space-x-2">
              <Avatar name={conversation.name} imageUrl={conversation.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{conversation.name}</p>
                <p className="text-xs text-gray-500 truncate">{conversation.lastMessage}</p>
              </div>
            </div>
          ))}
          {unreadMessages.length > 3 && (
            <p className="text-xs text-[#00CECE] text-center mt-2">
              View {unreadMessages.length - 3} more...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
