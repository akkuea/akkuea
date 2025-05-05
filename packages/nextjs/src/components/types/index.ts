import { StaticImageData } from 'next/image';

export interface Author {
  id: string;
  name: string;
  avatar: string;
}

export interface Category {
  name: string;
  type:
    | 'pedagogy'
    | 'technology'
    | 'socioemotional'
    | 'methodologies'
    | 'neuroscience'
    | 'inclusive';
}

export interface Publication {
  id: string;
  title: string;
  description: string;
  image: string | StaticImageData;
  date: string;
  category: Category;
  author: Author;
  hasVideo?: boolean;
}
