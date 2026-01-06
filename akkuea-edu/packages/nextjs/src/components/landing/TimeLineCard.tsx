'use client';

import { useEffect, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface TimeLineCardProps {
  icon: LucideIcon;
  timelineTitle: string;
  description: string;
}

export default function TimeLineCard({
  icon: Icon,
  timelineTitle,
  description,
}: TimeLineCardProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '-30% 0px -30% 0px',
        threshold: 0,
      }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="dark:bg-card h-full">
      <div
        ref={ref}
        className={`transition-opacity duration-1000 ease-out delay-300   ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-col pb-5 md:pb-1 h-full justify-between items-end gap-2 ">
          <p className="flex text-sm font-medium md:font-bold md:text-xl items-center gap-2 text-right">
            <span className="p-2 rounded-full  bg-[#F0FDFA] text-primary hidden md:block">
              <Icon />
            </span>
            <span className="text-black dark:text-foreground">{timelineTitle}</span>
          </p>
          <p className="mt-2 text-gray-700 dark:text-muted text-right text-sm md:text-base">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
