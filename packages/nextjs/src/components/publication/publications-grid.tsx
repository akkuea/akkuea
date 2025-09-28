import React from 'react';
import { PublicationCard } from './publication-card';
import { Publication } from '../types/index';

interface PublicationsGridProps {
  publications: Publication[];
}

export const PublicationsGrid: React.FC<PublicationsGridProps> = ({ publications }) => {
  console.log('PublicationsGrid', publications);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {publications.map((publication) => (
        <PublicationCard key={publication.id} publication={publication} />
      ))}
    </div>
  );
};
