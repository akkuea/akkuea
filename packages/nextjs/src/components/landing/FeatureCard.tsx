'use client';
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon: Icon }) => {
  return (
    <div className="bg-white dark:bg-card w-full max-w-[296px] h-[280px] xl:h-[320px] border border-about-cardBorder dark:border-border rounded-lg p-6 shadow-about-cardShadow hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer group">
      <div className="p-2 w-10 mb-10 rounded-lg bg-[#F0FDFA] text-primary items-center justify-center flex ">
        <Icon />
      </div>
      <h3 className="text-lg font-semibold text-about-text dark:text-foreground mb-10 group-hover:text-[#5EEAD4] dark:group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
};

export default FeatureCard;
