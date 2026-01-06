'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CarouselContext } from './CarouselContext';
import { useCarouselState } from './hooks/useCarouselState';
import type { CarouselProps } from './types';

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = 'horizontal',
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const carouselState = useCarouselState({
      orientation,
      opts,
      setApi,
      plugins,
    });

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          carouselState.scrollPrev();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          carouselState.scrollNext();
        }
      },
      [carouselState.scrollPrev, carouselState.scrollNext]
    );

    return (
      <CarouselContext.Provider value={carouselState}>
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn('relative', className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  }
);
Carousel.displayName = 'Carousel';

export default Carousel;