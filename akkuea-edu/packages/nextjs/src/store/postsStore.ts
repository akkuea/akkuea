import { create } from 'zustand';
import { PostProps } from '@/components/auth/store/data/post-types';

// Interface for the posts store
interface PostsState {
  posts: PostProps[];
  filteredPosts: PostProps[];
  searchQuery: string;
  loading: boolean;
  error: string | null;

  // Actions
  setPosts: (posts: PostProps[]) => void;
  setSearchQuery: (query: string) => void;
  searchPosts: (query: string) => void;
  clearSearch: () => void;
  addPost: (post: PostProps) => void;
}

// Function to normalize text (remove accents and convert to lowercase)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents and diacritics
    .replace(/[^\w\s]/g, ''); // Remove special characters
};

// Sample posts for development
const samplePosts: PostProps[] = [
  {
    id: '1',
    author: {
      name: 'Sebastián Salazar',
      username: 'sebastiánsalazar',
      avatar: '/placeholder.svg',
    },
    content: {
      text: 'Check out this interactive particle effect! Click to create more particles that move around the screen. Ideal for visualising systems that multiply, like stars in space.',
      media: [
        {
          type: 'video',
          url: 'https://www.youtube.com/embed/NWdEOAYm4FA?si=WbvhIlP1GBZkfwUt',
          aspectRatio: 16 / 9,
          downloadUrl: 'https://example.com/video.mp4',
        },
      ],
    },
    categories: [
      {
        name: 'Computer Science',
      },
      {
        name: 'Interactive Visualization',
      },
    ],
    modal: () => {},
  },
  {
    id: '2',
    author: {
      name: 'María González',
      username: 'mariagonzalez',
      avatar: '/placeholder.svg',
    },
    content: {
      text: 'Acabo de encontrar este increíble recurso sobre matemáticas. ¡Es perfecto para estudiantes que quieren mejorar sus habilidades!',
      links: [
        {
          url: 'https://example.com/math-resource',
          title: 'Matemáticas Avanzadas para Estudiantes',
          description: 'Una colección de problemas y soluciones para preparar exámenes',
        },
      ],
    },
    categories: [
      {
        name: 'Matemáticas',
      },
      {
        name: 'Educación',
      },
    ],
    modal: () => {},
  },
  {
    id: '3',
    author: {
      name: 'Carlos Rodríguez',
      username: 'carlosrodriguez',
      avatar: '/placeholder.svg',
    },
    content: {
      text: 'He estado aprendiendo sobre inteligencia artificial y machine learning. Aquí hay una presentación sobre cómo funciona una red neuronal.',
      media: [
        {
          type: 'image',
          url: '/placeholder.svg',
          aspectRatio: 16 / 9,
        },
      ],
    },
    categories: [
      {
        name: 'Inteligencia Artificial',
      },
      {
        name: 'Tecnología',
      },
    ],
    modal: () => {},
  },
];

// Creating the store
export const usePostsStore = create<PostsState>((set) => ({
  posts: samplePosts,
  filteredPosts: samplePosts,
  searchQuery: '',
  loading: false,
  error: null,

  setPosts: (posts) => set({ posts, filteredPosts: posts }),

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  searchPosts: (query) => {
    set((state) => {
      // If the search is empty, show all posts
      if (!query.trim()) {
        return { filteredPosts: state.posts, searchQuery: query };
      }

      // Normalize the search term
      const normalizedSearch = normalizeText(query);

      // Filter posts that match the search
      const filtered = state.posts.filter((post) => {
        // Normalize the post text
        const normalizedText = normalizeText(post.content.text);

        // Search in post text
        if (normalizedText.includes(normalizedSearch)) {
          return true;
        }

        // Search in categories (normalized)
        if (post.categories.some((cat) => normalizeText(cat.name).includes(normalizedSearch))) {
          return true;
        }

        // Search in author name or username (normalized)
        if (
          normalizeText(post.author.name).includes(normalizedSearch) ||
          normalizeText(post.author.username).includes(normalizedSearch)
        ) {
          return true;
        }

        // Search in links (normalized)
        if (
          post.content.links?.some(
            (link) =>
              (link.title && normalizeText(link.title).includes(normalizedSearch)) ||
              (link.description && normalizeText(link.description).includes(normalizedSearch))
          )
        ) {
          return true;
        }

        return false;
      });

      return { filteredPosts: filtered, searchQuery: query };
    });
  },

  clearSearch: () =>
    set((state) => ({
      searchQuery: '',
      filteredPosts: state.posts,
    })),

  addPost: (post) =>
    set((state) => {
      const newPosts = [post, ...state.posts];
      return {
        posts: newPosts,
        // If there's no active search, update filteredPosts
        filteredPosts: state.searchQuery ? state.filteredPosts : newPosts,
      };
    }),
}));
