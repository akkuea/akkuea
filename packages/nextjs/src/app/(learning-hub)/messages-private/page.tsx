'use client';

import { ConversationList } from '@/components/messages/conversation-list';
import { MessageThread } from '@/components/messages/message-thread';
import { MessageInput } from '@/components/messages/message-input';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import ReactTooltip from "react-tooltip"
import 'react-tooltip/dist/react-tooltip.css';

export default function MessagesPage() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Mobile sidebar toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
        onClick={() => setShowSidebar(!showSidebar)}
        data-tip={showSidebar ? "Close conversations" : "Open conversations"}
      >
        <Menu className="h-6 w-6" />
      </button>
      <ReactTooltip place="top" effect="solid" />

      {/* Conversation list sidebar */}
      <div
        className={`${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transform transition-transform duration-300 ease-in-out lg:static fixed inset-y-0 left-0 z-40 w-full max-w-xs bg-white border-r`}
      >
        <ConversationList onSelectConversation={() => setShowSidebar(false)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <MessageThread />
        <MessageInput />
      </div>
    </div>
  );
}
