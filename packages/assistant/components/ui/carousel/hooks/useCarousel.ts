'use client';

import { useContext } from 'react';
import { CarouselContext } from '../CarouselContext';

export const useCarousel = () => {
  const context = useContext(CarouselContext);
  
  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }

  return context;
};