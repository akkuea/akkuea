import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { generateMessageId, getFormattedTime } from '@/lib/utils';
import { MessagesState } from '@/app/Types/messages';

export const useMessages = create<MessagesState>()(
  devtools(
    persist(
      (set, get) => ({
        conversations: [
          {
            id: 'conv_1',
            name: 'xJeffx23',
            avatar: 'https://avatars.githubusercontent.com/u/171626566?v=4',
            lastMessage: 'Hey there!',
            timestamp: '10:30 AM',
            unread: true,
            messages: [
              {
                id: generateMessageId(),
                content: "Hey, how's it going?",
                sender: 'xJeffx23',
                senderAvatar: 'https://avatars.githubusercontent.com/u/171626566?v=4', // Add this line
                timestamp: '10:30 AM',
                type: 'received',
                read: true,
              },
              {
                id: generateMessageId(),
                content: 'Not bad, thanks! How about you?',
                sender: 'You',
                senderAvatar: '', // You can set a default avatar for the current user
                timestamp: '10:35 AM',
                type: 'sent',
                read: true,
              },
            ],
          },
          {
            id: 'conv_2',
            name: 'Josue19-08',
            avatar: 'https://avatars.githubusercontent.com/u/104031367?v=4',
            lastMessage: 'Check this out!',
            timestamp: '11:15 AM',
            unread: false,
            messages: [
              {
                id: generateMessageId(),
                content: 'Check this out!',
                sender: 'Josue19-08',
                senderAvatar: 'https://avatars.githubusercontent.com/u/104031367?v=4',
                timestamp: '11:15 AM',
                type: 'received',
                read: true,
              },
            ],
          },
          {
            id: 'conv_3',
            name: 'salazarsebas',
            avatar: 'https://avatars.githubusercontent.com/u/112297389?v=4',
            lastMessage: 'Hello!',
            timestamp: '09:45 AM',
            unread: false,
            messages: [
              {
                id: generateMessageId(),
                content: 'Hello!',
                sender: 'salazarsebas',
                senderAvatar: 'https://avatars.githubusercontent.com/u/112297389?v=4',
                timestamp: '09:45 AM',
                type: 'received',
                read: true,
              },
            ],
          },
        ],
        messages: {
          conv_1: [
            {
              id: generateMessageId(),
              content: "Hey, how's it going?",
              sender: 'xJeffx23',
              senderAvatar: 'https://avatars.githubusercontent.com/u/171626566?v=4', // Add this line
              timestamp: '10:30 AM',
              type: 'received',
              read: true,
            },
            {
              id: generateMessageId(),
              content: 'Not bad, thanks! How about you?',
              sender: 'You',
              senderAvatar: '', // You can set a default avatar for the current user
              timestamp: '10:35 AM',
              type: 'sent',
              read: true,
            },
          ],
          conv_2: [
            {
              id: generateMessageId(),
              content: 'Check this out!',
              sender: 'Josue19-08',
              senderAvatar: 'https://avatars.githubusercontent.com/u/104031367?v=4',
              timestamp: '11:15 AM',
              type: 'received',
              read: true,
            },
          ],
          conv_3: [
            {
              id: generateMessageId(),
              content: 'Hello!',
              sender: 'salazarsebas',
              senderAvatar: 'https://avatars.githubusercontent.com/u/112297389?v=4',
              timestamp: '09:45 AM',
              type: 'received',
              read: true,
            },
          ],
        },
        selectedConversationId: 'conv_1',

        addMessage: (conversationId, message) => {
          const id = generateMessageId();
          const timestamp = getFormattedTime();

          set((state) => {
            const conversation = state.conversations.find((conv) => conv.id === conversationId);
            const senderAvatar = message.type === 'received' ? conversation?.avatar || '' : '';

            const newMessage = {
              ...message,
              id,
              timestamp,
              senderAvatar,
            };

            const conversationMessages = state.messages[conversationId] || [];
            const updatedMessages = {
              ...state.messages,
              [conversationId]: [...conversationMessages, newMessage],
            };

            const updatedConversations = state.conversations.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    lastMessage: message.content,
                    timestamp,
                    unread: message.type === 'received',
                    messages: [...conv.messages, newMessage],
                  }
                : conv
            );

            return {
              messages: updatedMessages,
              conversations: updatedConversations,
            };
          });
        },

        selectConversation: (conversationId) => {
          set({ selectedConversationId: conversationId });
          get().markConversationAsRead(conversationId);
        },

        markConversationAsRead: (conversationId) => {
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === conversationId ? { ...conv, unread: false } : conv
            ),
            messages: {
              ...state.messages,
              [conversationId]: (state.messages[conversationId] || []).map((msg) => ({
                ...msg,
                read: true,
              })),
            },
          }));
        },

        setTypingStatus: (conversationId, isTyping) => {
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === conversationId ? { ...conv, isTyping } : conv
            ),
          }));
        },

        addConversation: (conversation) => {
          const id = generateMessageId('conv');
          const timestamp = getFormattedTime();

          set((state) => ({
            conversations: [
              {
                ...conversation,
                id,
                timestamp,
                lastMessage: '',
                unread: false,
                messages: [],
              },
              ...state.conversations,
            ],
            messages: {
              ...state.messages,
              [id]: [],
            },
          }));

          return id;
        },
      }),
      {
        name: 'messages-storage',
      }
    )
  )
);
