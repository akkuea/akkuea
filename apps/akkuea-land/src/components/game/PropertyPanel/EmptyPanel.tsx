import React from "react";
import { X } from "lucide-react";

export const EmptyPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center space-y-4">
      <div className="flex justify-end w-full absolute top-4 right-4">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-land-surface hover:bg-land-surface-raised border border-land-border text-land-fg-muted hover:text-land-fg transition-all duration-200"
        >
          <X size={16} />
        </button>
      </div>
      <div className="w-16 h-16 rounded-full bg-land-surface border border-land-border flex items-center justify-center text-land-fg-muted">
        <X size={32} />
      </div>
      <h3 className="text-lg font-bold text-land-fg">No Property Selected</h3>
      <p className="text-sm text-land-fg-muted">
        Click on a land tile to view its details and ownership status.
      </p>
    </div>
  );
};
