import React from "react";
import { BuildingLevel } from "../../../types/game.types";

/**
 * Building development level progression bar (4 steps)
 */
export const BuildingLevelBar: React.FC<{ buildingLevel: BuildingLevel }> = ({
  buildingLevel,
}) => {
  const steps = [
    { label: "Vacant", desc: "Level 0" },
    { label: "Residential", desc: "Level 1" },
    { label: "Commercial", desc: "Level 2" },
    { label: "Skyscraper", desc: "Level 3" },
  ];

  return (
    <div className="w-full bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
      <div className="text-[10px] font-semibold text-slate-400 mb-3 tracking-wider uppercase flex justify-between items-center">
        <span>Development Phase</span>
        <span className="text-xs font-bold text-indigo-400 bg-indigo-950/50 px-2.5 py-0.5 rounded-full border border-indigo-900/50">
          {steps[buildingLevel].label}
        </span>
      </div>
      <div className="relative flex justify-between items-center px-1">
        {/* Line Connector Background */}
        <div className="absolute left-3 right-3 top-3.5 h-[3px] bg-slate-800/80 rounded-full z-0">
          <div
            className="h-full bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-600 rounded-full transition-all duration-500"
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
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-4 ring-indigo-950/60 scale-110 shadow-lg shadow-indigo-500/30"
                    : isActive
                      ? "bg-indigo-600 text-indigo-100"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                }`}
              >
                {idx}
              </div>
              <span
                className={`text-[9px] mt-1.5 font-semibold transition-colors duration-300 ${
                  isCurrent
                    ? "text-indigo-400 font-bold"
                    : isActive
                      ? "text-slate-300"
                      : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Abbreviated Address Helper
export const abbreviateAddress = (addr: string) => {
  if (!addr) return "N/A";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
};
