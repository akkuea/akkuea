import React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

export const EmptyPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const t = useTranslations("PropertyPanel");

  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center space-y-4">
      <div className="flex justify-end w-full absolute top-4 right-4">
        <button
          onClick={onClose}
          aria-label={t("closeLabel")}
          className="p-1.5 rounded-full bg-land-surface hover:bg-land-surface-raised border border-land-border text-land-fg-muted hover:text-land-fg transition-all duration-200"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="w-16 h-16 rounded-full bg-land-surface border border-land-border flex items-center justify-center text-land-fg-muted">
        <X size={32} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-land-fg">{t("empty.title")}</h3>
      <p className="text-sm text-land-fg-muted">{t("empty.description")}</p>
    </div>
  );
};
