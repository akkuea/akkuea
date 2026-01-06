import React from 'react';

interface EmptyTabContentProps {
  title: string;
}

export const EmptyTabContent: React.FC<EmptyTabContentProps> = ({ title }) => {
  return (
    <div className="bg-card rounded-xl p-6 mb-6 shadow-sm border border-border">
      <h2 className="text-lg font-semibold mb-4 text-foreground">{title}</h2>
      <p className="text-muted">This tab is currently under development.</p>
    </div>
  );
};
