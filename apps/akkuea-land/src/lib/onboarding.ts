const key = (address: string) => `akkuea-land:onboarded:${address}`;

export const onboarding = {
  isComplete: (address: string): boolean => {
    if (typeof window === "undefined" || !address) return false;
    try {
      return window.localStorage.getItem(key(address)) === "true";
    } catch {
      return false;
    }
  },
  markComplete: (address: string): void => {
    if (typeof window === "undefined" || !address) return;
    try {
      window.localStorage.setItem(key(address), "true");
    } catch {
      // Storage may be unavailable in restricted browser contexts
    }
  },
};
