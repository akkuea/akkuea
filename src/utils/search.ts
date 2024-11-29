import Fuse from 'fuse.js';
import { generateMockUser } from './mockData';

// Generate a list of users for search
const users = Array.from({ length: 20 }, (_, i) => generateMockUser(i + 1));

const fuseOptions = {
  keys: ['username', 'bio'],
  threshold: 0.3,
  includeScore: true
};

const fuse = new Fuse(users, fuseOptions);

export const searchUsers = (query: string) => {
  if (!query) return [];
  return fuse.search(query).map(result => result.item);
};