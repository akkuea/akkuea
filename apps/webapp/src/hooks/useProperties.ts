"use client";

import { useCallback, useEffect, useState } from "react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { propertyApi } from "@/services/api/properties";
import { useLiveUpdates, type ConnectionStatus } from "@/hooks/useLiveUpdates";

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "We couldn't load marketplace properties. Please try again.";
}

const SSE_ENDPOINT =
  typeof process !== "undefined"
    ? process.env?.NEXT_PUBLIC_PROPERTIES_SSE_URL
    : undefined;

export function useProperties(
  options: UsePropertiesOptions = {},
): UsePropertiesResult {
  const { enableLiveUpdates = true, pollingInterval = 30000 } = options;

  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchProperties = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await propertyApi.getAll({
        limit: 100,
      });
      setProperties(response.data);
      setLastUpdatedAt(new Date());
      return response.data;
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
      throw fetchError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { connectionStatus, isPolling, data, refresh } = useLiveUpdates(
    async () => {
      const response = await propertyApi.getAll({ limit: 100 });
      return response.data;
    },
    {
      endpoint: SSE_ENDPOINT,
      pollingInterval,
      enabled: enableLiveUpdates && !isLoading,
      onUpdate: (updatedProperties) => {
        setProperties(updatedProperties);
        setLastUpdatedAt(new Date());
      },
    },
  );

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    if (data && data.length > 0) {
      setProperties(data);
    }
  }, [data]);

  const refetch = useCallback(async () => {
    await fetchProperties();
    refresh();
  }, [fetchProperties, refresh]);

  return {
    properties,
    isLoading,
    error,
    refetch,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
  };
}
