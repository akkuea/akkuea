export interface ActionButtonProps {
  onClick: () => void;
  label: string;
  isDarkMode: boolean;
  isDanger?: boolean;
}

export function ActionButton({ onClick, label, isDarkMode, isDanger = false }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={
        isDanger
          ? `px-4 py-2 rounded ${
              isDarkMode 
                ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400' 
                : 'bg-red-100 hover:bg-red-200 text-red-600'
            }`
          : `px-4 py-2 rounded ${
              isDarkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`
      }
    >
      {label}
    </button>
  );
}
