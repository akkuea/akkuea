import type React from 'react';

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
    <h2
      className={`text-lg font-semibold ${isDarkMode ? 'text-foreground-dark' : 'text-foreground-light'}`}
    >
      {title}
    </h2>
  );
}

export function SectionDescription({ text, isDarkMode }: SectionDescriptionProps) {
  return <p className={isDarkMode ? 'text-muted-dark' : 'text-muted-light'}>{text}</p>;
}

export function SectionContainer({ children, hasBorder = true }: SectionContainerProps) {
  return (
    <div className={`mb-6 ${hasBorder ? 'pb-6 border-b border-border-dark' : ''}`}>{children}</div>
  );
}
