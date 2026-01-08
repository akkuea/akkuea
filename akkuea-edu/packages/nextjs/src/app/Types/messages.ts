export interface Message {
  id: string;
  content: string;
  sender: string;
  senderAvatar: string;
  timestamp: string;
  type: 'received' | 'sent';
  read: boolean;
  mediaUrl?: string | null;
  linkPreview?: {
    url: string;
    title: string;
    description: string;
    image: string;
  } | null;
}

export interface MessageBubbleProps {
  message: Message;
}

export interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  isTyping?: boolean;
  messages: Message[];
}

export interface ConversationItemProps {
  conversation: Conversation;
  onSelect: () => void;
}

export interface ConversationListProps {
  onSelectConversation: () => void;
}

export interface MessagesState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  selectedConversationId: string | null;
  addMessage: (
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'senderAvatar'>
  ) => void;
  selectConversation: (conversationId: string) => void;
  markConversationAsRead: (conversationId: string) => void;
  setTypingStatus: (conversationId: string, isTyping: boolean) => void;
  addConversation: (
    conversation: Omit<Conversation, 'id' | 'timestamp' | 'lastMessage' | 'unread'>
  ) => void;
}

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}
