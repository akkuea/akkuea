'use client';

export interface ToggleSwitchProps {
  isChecked: boolean;
  onChange: () => void;
}

export function ToggleSwitch({ isChecked, onChange }: ToggleSwitchProps) {
  return (
    <label className="inline-flex items-center">
      <input type="checkbox" className="hidden" checked={isChecked} onChange={onChange} />
      <div
        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
          isChecked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
            isChecked ? 'translate-x-6' : ''
          }`}
        ></div>
      </div>
    </label>
  );
}
