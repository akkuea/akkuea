/**
 * MSW browser setup - registers the service worker for browser-side mocking.
 *
 * Only imported when NEXT_PUBLIC_USE_MOCK=true.
 * This file must only be imported in client-side code.
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
