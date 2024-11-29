// Utility function to get deterministic random number
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export interface User {
  id: number;
  username: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
}

export interface Comment {
  id: number;
  userId: number;
  username: string;
  avatar: string;
  content: string;
  timestamp: string;
}

export interface Post {
  id: number;
  userId: number;
  username: string;
  avatar: string;
  content: string;
  image?: string;
  likes: number;
  comments: Comment[];
  isLiked?: boolean;
  timestamp: string;
}

export const generateMockUser = (id: number): User => {
  return {
    id,
    username: `user${id}`,
    avatar: `https://i.pravatar.cc/150?img=${id}`,
    bio: `Hi, I'm user${id}! This is my bio.`,
    followers: Math.floor(seededRandom(id * 1) * 1000),
    following: Math.floor(seededRandom(id * 2) * 500)
  };
};

export const generateMockComment = (id: number, postId: number): Comment => {
  const seed = postId * 1000 + id;
  const userId = Math.floor(seededRandom(seed) * 10) + 1;
  
  return {
    id,
    userId,
    username: `user${userId}`,
    avatar: `https://i.pravatar.cc/150?img=${userId}`,
    content: `This is comment #${id} on post #${postId}`,
    timestamp: new Date(2024, 0, 1 + id).toLocaleDateString()
  };
};

export const generateMockPost = (id: number): Post => {
  const seed = id * 1000;
  const userId = Math.floor(seededRandom(seed) * 10) + 1;
  
  return {
    id,
    userId,
    username: `user${userId}`,
    avatar: `https://i.pravatar.cc/150?img=${userId}`,
    content: `This is a sample post #${id}. The content is generated for demonstration purposes.`,
    image: id % 3 === 0 ? `https://picsum.photos/seed/${seed}/800/600` : undefined,
    likes: Math.floor(seededRandom(seed + 1) * 1000) + 1,
    comments: Array.from({ length: 2 }, (_, i) => generateMockComment(i + 1, id)),
    isLiked: false,
    timestamp: new Date(2024, 0, 1 + id).toLocaleDateString()
  };
};