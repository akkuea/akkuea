export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface PostProps {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  content: {
    text: string;
    media?: Array<{
      type: 'image' | 'video' | 'embed';
      url: string;
      aspectRatio?: number;
      downloadUrl?: string;
      thumbnailUrl?: string;
    }>;
    links?: Array<{
      url: string;
      title?: string;
      description?: string;
      image?: string;
    }>;
  };
  categories: Array<{
    name: string;
    icon?: React.ReactNode;
  }>;
  modal: () => void;
}
