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

  const fetchProperties = useCallback(async () => {
    const response = await propertyApi.getAll({ limit: 100 });
    setLastUpdatedAt(new Date());
    return response.data;
  }, []);

  const {
    data,
    error,
    isLoading,
    execute,
    retry,
    setData,
  } = useAsyncState(fetchProperties, {
    isEmpty: (loaded) => !loaded || loaded.length === 0,
  });

  const { connectionStatus, isPolling, refresh } = useLiveUpdates(
    async () => (await propertyApi.getAll({ limit: 100 })).data,
    {
      endpoint: SSE_ENDPOINT,
      pollingInterval,
      enabled: enableLiveUpdates && !isLoading,
      onUpdate: (updatedProperties) => {
        setData(updatedProperties);
        setLastUpdatedAt(new Date());
      },
    },
  );

  useEffect(() => {
    void execute();
  }, [execute]);

  const refetch = useCallback(async () => {
    await retry();
    refresh();
  }, [retry, refresh]);

  return {
    properties: data ?? [],
    isLoading,
    error,
    refetch,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
  };
}
