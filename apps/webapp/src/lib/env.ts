import { validateWebappEnv } from "@akkuea/shared";

// Validate webapp environment variables at boot time
export const env = validateWebappEnv();
