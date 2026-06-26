import React from "react";
import { X } from "lucide-react";

export const EmptyPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center space-y-4">
      <div className="flex justify-end w-full absolute top-4 right-4">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all duration-200"
        >
          <X size={16} />
        </button>
      </div>
      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
        <X size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-200">No Property Selected</h3>
      <p className="text-sm text-slate-500">
        Click on a land tile to view its details and ownership status.
      </p>
    </div>
  );
};
