const key = (address: string) => `akkuea-land:onboarded:${address}`;

export const onboarding = {
  isComplete: (address: string) =>
    typeof window !== "undefined" &&
    localStorage.getItem(key(address)) === "true",
  markComplete: (address: string) => localStorage.setItem(key(address), "true"),
};
