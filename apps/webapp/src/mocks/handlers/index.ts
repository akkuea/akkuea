import { propertyHandlers } from "./properties";
import { lendingHandlers } from "./lending";
import { userHandlers } from "./users";
import { transactionHandlers } from "./transactions";
import { adminHandlers } from "./admin";

/**
 * All MSW request handlers, combined in one export.
 * Import this array into the browser and server MSW setups.
 */
export const handlers = [
  ...propertyHandlers,
  ...lendingHandlers,
  ...userHandlers,
  ...transactionHandlers,
  ...adminHandlers,
];
