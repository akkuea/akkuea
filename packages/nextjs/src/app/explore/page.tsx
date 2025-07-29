'use client';
import React, { useState } from 'react';
import ExploreHeader from '@/components/explore/explore-header';
import ContentCard from '@/components/explore/content-card';
import PeopleCard from '@/components/explore/people-card';
import PopularTopics from '@/components/explore/popular-topics';
import EmptyState from '@/components/explore/empty-components';
import TabNavigation from '@/components/explore/tab-navigation';

const ExplorePage = () => {
  const [activeTab, setActiveTab] = useState<string | number>('trending');
  const [searchQuery, setSearchQuery] = useState('');

  const popularTopics = [
    'Artificial Intelligence',
    'Web Development',
    'Data Science',
    'UX/UI Design',
    'Programming',
    'Math',
    'Physics',
    'Biology',
    'History',
    'Literature',
    'Machine Learning',
    'Cybersecurity',
  ];

  const trendingContent = [
    {
      id: 1,
      title: 'Introduction to Machine Learning: A Comprehensive Guide',
      author: 'Dr. Sarah Chen',
      readTime: '12 min read',
      topic: 'Artificial Intelligence',
      topicColor: 'bg-cyan-100 text-cyan-700',
      likes: 1245,
      comments: 89,
    },
    {
      id: 2,
      title: 'Modern Web Development with React and Next.js',
      author: 'Carlos Rodriguez',
      readTime: '8 min read',
      topic: 'Web Development',
      topicColor: 'bg-cyan-100 text-cyan-700',
      likes: 876,
      comments: 124,
    },
    {
      id: 3,
      title: 'Data Visualization: Principles and Best Practices',
      author: 'Ana Lopez',
      readTime: '15 min read',
      topic: 'Data Science',
      topicColor: 'bg-cyan-100 text-cyan-700',
      likes: 543,
      comments: 67,
    },
    {
      id: 4,
      title: 'Quantum Physics Explained for Beginners',
      author: 'Prof. Juan Martinez',
      readTime: '20 min read',
      topic: 'Physics',
      topicColor: 'bg-cyan-100 text-cyan-700',
      likes: 432,
      comments: 56,
    },
  ];

  const featuredContent = [
    {
      id: 1,
      title: 'The Future of Education: AI-Powered Learning',
      author: 'Dr. Emily Watson',
      specialty: 'Education Technology',
      likes: 2341,
      comments: 156,
      featured: true,
    },
    {
      id: 2,
      title: 'Complete Guide to Full-Stack Development',
      author: 'Michael Chang',
      specialty: 'Programming',
      likes: 1987,
      comments: 203,
      featured: true,
    },
    {
      id: 3,
      title: 'Neuroscience-Based Study Techniques',
      author: 'Dr. Rachel Green',
      specialty: 'Learning Science',
      likes: 1654,
      comments: 134,
      featured: true,
    },
  ];

  const people = [
    {
      id: 1,
      name: 'Dr. Alex Thompson',
      username: '@alexthompson',
      specialty: 'Machine Learning',
      followers: 15420,
      posts: 234,
    },
    {
      id: 2,
      name: 'Maria Gonzalez',
      username: '@mariagonzalez',
      specialty: 'UX Design',
      followers: 8765,
      posts: 156,
    },
    {
      id: 3,
      name: 'Prof. David Kim',
      username: '@davidkim',
      specialty: 'Data Science',
      followers: 12340,
      posts: 189,
    },
    {
      id: 4,
      name: 'Lisa Wang',
      username: '@lisawang',
      specialty: 'Web Development',
      followers: 9876,
      posts: 267,
    },
    {
      id: 5,
      name: 'Dr. James Wilson',
      username: '@jameswilson',
      specialty: 'Physics',
      followers: 6543,
      posts: 145,
    },
    {
      id: 6,
      name: 'Sophie Brown',
      username: '@sophiebrown',
      specialty: 'Biology',
      followers: 7890,
      posts: 198,
    },
  ];

  const tabs = [
    { id: 'trending', label: 'Trending', icon: '📈' },
    { id: 'featured', label: 'Featured', icon: '⭐' },
    { id: 'people', label: 'People', icon: '👥' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'trending':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-6">
            {trendingContent.map((item) => (
              <ContentCard key={item.id} type="trending" item={item} />
            ))}
          </div>
        );
      case 'featured':
        return (
          <div className="space-y-6">
            {featuredContent.map((item) => (
              <ContentCard key={item.id} type="featured" item={item} />
            ))}
          </div>
        );
      case 'people':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {people.map((person) => (
              <PeopleCard key={person.id} person={person} />
            ))}
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-6">
            {trendingContent.map((item) => (
              <ContentCard key={item.id} type="trending" item={item} />
            ))}
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen `}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <ExploreHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />
        {activeTab === 'trending' && <PopularTopics topics={popularTopics} />}
        {activeTab === 'trending' && (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-6">
            Trending Content
          </h2>
        )}
        {renderContent()}
        {searchQuery && !renderContent() && <EmptyState />}
      </div>
    </div>
  );
};

export default ExplorePage;
