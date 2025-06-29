import { type LucideIcon } from 'lucide-react';

export interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isDarkMode: boolean;
  onClick: () => void;
}

export function NavButton({ icon, label, isActive, isDarkMode, onClick }: NavButtonProps) {
  const Icon = icon;

  return (
    <button
      onClick={onClick}
      className={
        isActive
          ? `flex items-center flex-shrink-0 px-6 py-3 mx-1 ${
              isDarkMode ? 'bg-gray-900 text-teal-400' : 'bg-white text-teal-600'
            } rounded-lg shadow-sm`
          : `flex items-center flex-shrink-0 px-6 py-3 mx-1 ${
              isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'
            } rounded-lg transition-colors duration-200`
      }
    >
      <Icon className="w-5 h-5 mr-2" />
      <span>{label}</span>
    </button>
  );
}
