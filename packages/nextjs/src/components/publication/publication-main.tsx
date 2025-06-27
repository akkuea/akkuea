import firstImage4 from '../../../public/Background(1).png';
import firstImage3 from '../../../public/Background.png';
import firstImage2 from '../../../public/Body.png';
import firstImage6 from '../../../public/Body(1).png';
import firstImage1 from '../../../public/Effective.png';
// pages/index.tsx or your desired page
import React from 'react';
import { PublicationsSection } from './publications-section';
import { Publication } from '../types';

// Sample data to match your image
const publicationsData: Publication[] = [
  {
    id: '1',
    title: 'Effective strategies for collaborative learning in',
    description:
      'Collaborative learning in virtual environments presents unique challenges. In this article we',
    image: firstImage1,
    date: 'Apr 15, 2023',
    category: {
      name: 'Pedagogy',
      type: 'pedagogy',
    },
    author: {
      id: '1',
      name: 'Laura Martinez',
      avatar: '/Javier Torres.png',
    },
  },
  {
    id: '2',
    title: 'Digital tools for real-time formative assessment',
    description:
      'Discover how to use digital tools to conduct effective formative assessments that provide',
    image: firstImage2,
    date: 'May 3, 2023',
    category: {
      name: 'Educational Technology',
      type: 'technology',
    },
    author: {
      id: '2',
      name: 'Carlos Rodriguez',
      avatar: '/Effective.png',
    },
  },
  {
    id: '3',
    title: 'Emotional intelligence in the classroom: strategic',
    description:
      'Emotional intelligence is as important as academic skills. Learn how to effectively integrate',
    image: firstImage3,
    date: 'May 20, 2023',
    category: {
      name: 'Socioemotional Development',
      type: 'socioemotional',
    },
    author: {
      id: '3',
      name: 'Ana Lopez',
      avatar: '/Container.png',
    },
  },
  {
    id: '4',
    title: 'Project-based learning: practical implementation',
    description:
      'A step-by-step guide to implementing project-based learning in your classroom, with',
    image: firstImage2,
    date: 'Jun 8, 2023',
    category: {
      name: 'Active Methodologies',
      type: 'methodologies',
    },
    author: {
      id: '4',
      name: 'Miguel Sanchez',
      avatar: '/Effective.png',
    },
  },
  {
    id: '5',
    title: 'Neuroscience and education: practical',
    description: 'Discover how advances in neuroscience can inform your pedagogical practices and',
    image: firstImage4,
    date: 'Jun 17, 2023',
    category: {
      name: 'Neuroscience',
      type: 'neuroscience',
    },
    author: {
      id: '5',
      name: 'Elena Gomez',
      avatar: '/Elena Gomez.png',
    },
    hasVideo: true,
  },
  {
    id: '6',
    title: 'Universal Design for Learning: creating',
    description:
      'Universal Design for Learning offers a framework for creating educational environments',
    image: firstImage6,
    date: 'Jul 2, 2023',
    category: {
      name: 'Inclusive Education',
      type: 'inclusive',
    },
    author: {
      id: '6',
      name: 'Javier Torres',
      avatar: '/Container.png',
    },
  },
];

export default function PublicationMain() {
  return (
    <div className="w-full py-8 ">
      <PublicationsSection publications={publicationsData} />
    </div>
  );
} 