import { LucideIcon } from 'lucide-react';

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
  category: string;
  progress: number;
  status: 'completed' | 'in-progress' | 'locked';
  completedDate?: string;
  progressText?: string;
}
