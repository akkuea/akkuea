'use client';

import * as React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { CarouselApi, CarouselOptions } from '../types';

export interface UseCarouselStateProps {
  opts?: CarouselOptions;
  plugins?: any[];
  orientation: 'horizontal' | 'vertical';
  setApi?: (api: CarouselApi) => void;
}

export const useCarouselState = ({
  orientation,
  opts,
  setApi,
  plugins,
}: UseCarouselStateProps) => {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === 'horizontal' ? 'x' : 'y',
    },
    plugins
  );
  
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: CarouselApi | null) => {
    if (!api) return;
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  React.useEffect(() => {
    if (!api || !setApi) return;
    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) return;

    onSelect(api);
    api.on('reInit', onSelect);
    api.on('select', onSelect);

    return () => {
      api?.off('select', onSelect);
    };
  }, [api, onSelect]);

  return {
    carouselRef,
    api,
    canScrollPrev,
    canScrollNext,
    scrollPrev,
    scrollNext,
    orientation,
    opts
  };
};