import React from 'react';

export interface SectionTitleProps {
  title: string;
  isDarkMode: boolean;
}

export interface SectionDescriptionProps {
  text: string;
  isDarkMode: boolean;
}

export interface SectionContainerProps {
  children: React.ReactNode;
  hasBorder?: boolean;
}

export function SectionTitle({ title, isDarkMode }: SectionTitleProps) {
  return (
    <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
      {title}
    </h2>
  );
}

export function SectionDescription({ text, isDarkMode }: SectionDescriptionProps) {
  return <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{text}</p>;
}

export function SectionContainer({ children, hasBorder = true }: SectionContainerProps) {
  return (
    <div
      className={`mb-6 ${hasBorder ? 'pb-6 border-b border-gray-200 dark:border-gray-800' : ''}`}
    >
      {children}
    </div>
  );
}
