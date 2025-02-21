'use client';

import React from 'react';
import { useModalStore } from '@/store/useModalStore';
import Image from 'next/image';

export const Example = () => {
  const { openModal } = useModalStore();

  const handleOpenModal = () => {
    openModal(
      <div>
        <h2 className="text-2xl font-bold mb-4">Post Title</h2>

        <div className="mb-4">
          <Image src="/example.jpg" alt="Post image" className="rounded-lg" />
        </div>

        <p className="mb-4">Post content goes here...</p>

        <div className="flex gap-4 mb-4">
          <span>❤️ 123 likes</span>
          <span>💬 45 comments</span>
          <span>🔄 12 shares</span>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold">Comments</h3>
        </div>

        <div className="mt-4 pt-4 border-t">
          <h3 className="font-bold mb-2">Share</h3>
          <div className="flex gap-2"></div>
        </div>
      </div>
    );
  };

  return (
    <button onClick={handleOpenModal} className="px-4 py-2 bg-blue-500 text-white rounded-lg">
      Open Modal
    </button>
  );
};
