'use client';

import Post from './post';
import { Toaster } from 'sonner';
import { useModalStore } from '@/store/useModalStore';
import { usePostsStore } from '@/store/postsStore';

export default function Page() {
  const { onOpen } = useModalStore();
  const { filteredPosts } = usePostsStore();

  if (filteredPosts.length === 0) {
    return (
      <div className="max-w-4xl w-full mx-auto px-8 py-12 text-center">
        <h2 className="text-xl font-semibold mb-2">No se encontraron resultados</h2>
        <p className="text-muted-foreground">Intenta con otra búsqueda</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full mx-auto px-8">
      <div className="w-full space-y-6">
        {filteredPosts.map((post) => {
          const component = (
            <Post
              key={post.id}
              id={post.id}
              author={post.author}
              content={post.content}
              categories={post.categories}
              modal={() =>
                onOpen(
                  <Post
                    id={post.id}
                    author={post.author}
                    content={post.content}
                    categories={post.categories}
                    modal={() => {}}
                  />
                )
              }
            />
          );

          return <div key={post.id}>{component}</div>;
        })}
        <Toaster />
      </div>
    </div>
  );
}
