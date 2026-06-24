import { PropertyInfo } from "@akkuea/shared";

export type BuildingLevel = 0 | 1 | 2 | 3;

/**
 * Game-specific extended fields for Akkuea Land
 */
export interface GamePropertyFields {
  buildingLevel: BuildingLevel;
  earnedIncome?: number; // Accrued rental income
  improveCost?: number; // Cost in LAND to improve to next level
  isListed?: boolean; // Whether the property is listed for sale by a player
}

/**
 * PropertyInfo extended with game-specific fields
 */
export type GameProperty = PropertyInfo & GamePropertyFields;

/**
 * Explicit TypeScript discriminated union for the 4 ownership states
 */
export type PropertyOwnershipState =
  | {
      type: "unowned";
      property: GameProperty;
      viewerAddress: string;
    }
  | {
      type: "owned_by_viewer";
      property: GameProperty;
      viewerAddress: string;
    }
  | {
      type: "listed_by_other";
      property: GameProperty;
      viewerAddress: string;
    }
  | {
      type: "not_connected";
      property: GameProperty;
    };
