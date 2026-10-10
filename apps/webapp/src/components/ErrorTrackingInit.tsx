"use client";

import { useEffect } from "react";
import { initWebErrorTracking } from "@/lib/errorTracking";

initWebErrorTracking();

export function ErrorTrackingInit() {
  useEffect(() => {
    initWebErrorTracking();
  }, []);
  return null;
}
