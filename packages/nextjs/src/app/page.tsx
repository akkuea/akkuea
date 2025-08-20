'use client';

import { useGlobalAuthenticationStore } from '@/components/auth/store/data';
import QuickPost from '@/components/quick-post/quick-post';
import CreatePostModal from '@/components/floating-button/button';
import Post from '@/components/post/page';

export default function Home() {
  const address = useGlobalAuthenticationStore((state) => state.address);

  return (
    <div className="flex flex-col  min-h-screen font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 w-full items-center">
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <p>{address}</p>
        </div>
        <QuickPost />
        <Post />
      </main>
      <CreatePostModal />
    </div>
  );
}
