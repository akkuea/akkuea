"use client";

import { useCallback, useEffect, useState } from "react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { propertyApi } from "@/services/api/properties";
import { useLiveUpdates, type ConnectionStatus } from "@/hooks/useLiveUpdates";
import { useAsyncState } from "@/hooks/useAsyncState";

interface UsePropertiesOptions {
  enableLiveUpdates?: boolean;
  pollingInterval?: number;
}

interface UsePropertiesResult {
  properties: PropertyInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  connectionStatus: ConnectionStatus;
  lastUpdatedAt: Date | null;
  isPolling: boolean;
}

const SSE_ENDPOINT =
  typeof process !== "undefined"
    ? process.env?.NEXT_PUBLIC_PROPERTIES_SSE_URL
    : undefined;

export function useProperties(
  options: UsePropertiesOptions = {},
): UsePropertiesResult {
  const { enableLiveUpdates = true, pollingInterval = 30000 } = options;
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchProperties = useCallback(
    () => propertyApi.getAll({ limit: 100 }).then((res) => res.data),
    [],
  );

  const asyncState = useAsyncState(fetchProperties, {
    isEmpty: (data) => data.length === 0,
  });

  const { connectionStatus, isPolling, refresh } = useLiveUpdates(
    async () => (await propertyApi.getAll({ limit: 100 })).data,
    {
      endpoint: SSE_ENDPOINT,
      pollingInterval,
      enabled: enableLiveUpdates && !asyncState.isLoading,
      onUpdate: (updatedProperties) => {
        asyncState.setData(updatedProperties);
        setLastUpdatedAt(new Date());
      },
    },
  );

  useEffect(() => {
    void asyncState.execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncState.execute]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (asyncState.status === "success") setLastUpdatedAt(new Date());
  }, [asyncState.status]);

  const refetch = useCallback(async () => {
    await asyncState.retry();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncState.retry, refresh]);

  return {
    properties: asyncState.data ?? [],
    isLoading: asyncState.isLoading,
    error: asyncState.error,
    refetch,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
  };
}
