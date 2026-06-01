"use client";

import { useCallback, useMemo, useState } from "react";
import { useWallet } from "./useWallet.hook";
import { useAutoClearError } from "./useAutoClearError.hook";

/**
 * Manages wallet provider selection modal state for pages that need a connect CTA.
 */
export function useWalletConnectModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const { connectWith, providers } = useWallet();

  const clearConnectError = useCallback(() => setConnectError(null), []);

  useAutoClearError(connectError, clearConnectError);

  const openConnectModal = useCallback(() => {
    setConnectError(null);
    setIsOpen(true);
  }, []);

  const closeConnectModal = useCallback(() => {
    setConnectError(null);
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    async (providerId: string) => {
      setConnectError(null);
      try {
        await connectWith(providerId);
      } catch (err) {
        setConnectError(
          err instanceof Error ? err.message : "Connection failed",
        );
        throw err;
      }
    },
    [connectWith],
  );

  const connectModalProps = useMemo(
    () => ({
      open: isOpen,
      error: connectError,
      providers,
      onClose: closeConnectModal,
      onSelect: handleSelect,
    }),
    [isOpen, connectError, providers, closeConnectModal, handleSelect],
  );

  return { openConnectModal, connectModalProps };
}
