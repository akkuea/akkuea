'use client';

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
  return (
    <div className="flex flex-col pb-5 md:pb-1 h-full justify-between items-end gap-2 ">
      <p className="flex text-sm font-medium md:font-bold md:text-xl items-center gap-2 text-right">
        <span className="p-2 rounded-full bg-[#F0FDFA] text-primary hidden md:block">
          <Icon />
        </span>
        <span>{timelineTitle}</span>
      </p>
      <p className="mt-2 text-gray-700 text-right text-sm md:text-base">{description}</p>
    </div>
  );
}
