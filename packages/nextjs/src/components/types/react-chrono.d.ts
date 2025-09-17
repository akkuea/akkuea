declare module 'react-chrono' {
  import * as React from 'react';

  export interface TimelineItem {
    title?: string;
    cardTitle?: string;
    cardSubtitle?: string;
    cardDetailedText?: string | string[];
    media?: { type: 'IMAGE' | 'VIDEO' | 'AUDIO'; source: { url: string } };
    icon?: React.ReactNode;
  }

  export interface ChronoProps {
    items?: TimelineItem[];
    mode?: 'HORIZONTAL' | 'VERTICAL' | 'VERTICAL_ALTERNATING';
    cardHeight?: number;
    cardWidth?: number;
    theme?: {
      primary?: string;
      secondary?: string;
      cardBgColor?: string;
      cardForeColor?: string;
      titleColor?: string;
    };
    disableToolbar?: boolean;
    useReadMore?: boolean;
    slideshow?: boolean;
    slideItemDuration?: number;
    slideShowType?: 'reveal' | 'slide_from_sides' | 'slide_in';
    children?: React.ReactNode;
  }

  export const Chrono: React.FC<ChronoProps>;
}
