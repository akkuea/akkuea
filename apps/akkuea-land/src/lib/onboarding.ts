const key = (address: string) => `akkuea-land:onboarded:${address}`;

export const onboarding = {
  isComplete: (address: string): boolean => {
    if (!address.trim() || typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem(key(address)) === "true";
    } catch {
      return false;
    }
  },
  markComplete: (address: string): void => {
    if (!address.trim() || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(key(address), "true");
    } catch {
      // Storage unavailable (private browsing or quota exceeded).
    }
  },
};
