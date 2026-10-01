import React from "react";
import { useTranslations } from "next-intl";
import { BuildingLevel } from "../../../types/game.types";

/**
 * Building development level progression bar (4 steps)
 */
export const BuildingLevelBar: React.FC<{ buildingLevel: BuildingLevel }> = ({
  buildingLevel,
}) => {
  const t = useTranslations("PropertyPanel");
  const tBuilding = useTranslations("Building");
  const steps = [
    tBuilding("vacant"),
    tBuilding("residential"),
    tBuilding("commercial"),
    tBuilding("skyscraper"),
  ];

  return (
    <div className="w-full bg-land-bg/50 p-4 rounded-xl border border-land-border/80">
      <div className="text-[10px] font-semibold text-land-fg-muted mb-3 tracking-wider uppercase flex justify-between items-center">
        <span>{t("developmentPhase")}</span>
        <span className="text-xs font-bold text-land-accent bg-land-accent/10 px-2.5 py-0.5 rounded-full border border-land-accent/50">
          {steps[buildingLevel]}
        </span>
      </div>
      <div className="relative flex justify-between items-center px-1">
        {/* Line Connector Background */}
        <div className="absolute left-3 right-3 top-3.5 h-[3px] bg-land-surface-raised/80 rounded-full z-0">
          <div
            className="h-full bg-gradient-to-r from-land-accent via-land-accent to-tile-listed rounded-full transition-all duration-500"
            style={{ width: `${(buildingLevel / 3) * 100}%` }}
          />
        </div>

        {steps.map((step, idx) => {
          const isActive = idx <= buildingLevel;
          const isCurrent = idx === buildingLevel;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-all duration-300 ${
                  isCurrent
                    ? "bg-gradient-to-br from-land-accent-fill to-tile-listed-fill text-land-on-accent ring-4 ring-land-accent-fill/60 scale-110 shadow-lg shadow-land-accent-fill/30"
                    : isActive
                      ? "bg-land-accent text-land-accent"
                      : "bg-land-surface text-land-fg-muted border border-land-border"
                }`}
              >
                {idx}
              </div>
              <span
                className={`text-[9px] mt-1.5 font-semibold transition-colors duration-300 ${
                  isCurrent
                    ? "text-land-accent font-bold"
                    : isActive
                      ? "text-land-fg"
                      : "text-land-fg-muted"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Abbreviated Address Helper. Callers are responsible for translating the
// empty-address case; this only formats a real address string.
export const abbreviateAddress = (addr: string) => {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
};
