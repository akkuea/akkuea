import { useState } from "react";
import { GameProperty } from "../types/game.types";
import { getWalletKit } from "@/lib/walletKit";

export const usePropertyActions = (
  property: GameProperty,
  onPropertyUpdate: (updated: GameProperty) => void,
  viewerAddress: string | null,
  isConnected: boolean,
) => {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAction = async (
    actionName: string,
    pendingMsg: string,
    optimisticUpdate: () => GameProperty,
    txLogic: () => Promise<void>,
  ) => {
    if (!isConnected || !viewerAddress) {
      setError("Wallet not connected");
      return;
    }

    const previousProperty = { ...property };
    setPendingAction(pendingMsg);
    setError(null);
    setSuccess(null);

    try {
      onPropertyUpdate(optimisticUpdate());
      await txLogic();
      setSuccess(`${actionName} completed successfully!`);
    } catch (err) {
      onPropertyUpdate(previousProperty);
      setError(err instanceof Error ? err.message : `${actionName} failed.`);
    } finally {
      setPendingAction(null);
    }
  };

  const buyFromTreasury = async () => {
    await handleAction(
      "Buy from Treasury",
      "Signing treasury purchase on Stellar...",
      () => ({
        ...property,
        owner: viewerAddress!,
        availableShares: 0,
      }),
      async () => {
        const kit = getWalletKit();
        if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");

        // Mock a transaction envelope (XDR representation) for the Treasury purchase
        // TODO: replace with real Soroban contract invocation XDR
        // Tracked in: [link to contract task]
        const mockXdr = "AAAAAgAAAAD5r+Hl5S94D......";
        await kit.signTransaction(mockXdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: viewerAddress!,
        });
      },
    );
  };

  const improveProperty = async () => {
    if (property.buildingLevel >= 3) {
      setError("Property is already at maximum level (Skyscraper).");
      return;
    }
    const nextLevel = (property.buildingLevel + 1) as 0 | 1 | 2 | 3;
    const cost = property.improveCost || 100;

    await handleAction(
      "Improve Property",
      `Signing level improvement to ${
        nextLevel === 1
          ? "Residential"
          : nextLevel === 2
            ? "Commercial"
            : "Skyscraper"
      } on Stellar...`,
      () => ({
        ...property,
        buildingLevel: nextLevel,
        improveCost: cost * 2,
      }),
      async () => {
        const kit = getWalletKit();
        if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");

        // TODO: replace with real Soroban contract invocation XDR
        // Tracked in: [link to contract task]
        const mockXdr = "AAAAAgAAAAD5r+Hl5S94D......";
        await kit.signTransaction(mockXdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: viewerAddress!,
        });
      },
    );
  };

  const listForSale = async (price: number) => {
    if (price <= 0) {
      setError("Listing price must be greater than zero.");
      return;
    }

    await handleAction(
      "List for Sale",
      "Signing listing creation on Stellar...",
      () => ({
        ...property,
        pricePerShare: price.toString(),
        isListed: true,
      }),
      async () => {
        const kit = getWalletKit();
        if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");

        // TODO: replace with real Soroban contract invocation XDR
        // Tracked in: [link to contract task]
        const mockXdr = "AAAAAgAAAAD5r+Hl5S94D......";
        await kit.signTransaction(mockXdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: viewerAddress!,
        });
      },
    );
  };

  const claimIncome = async () => {
    const earned = property.earnedIncome || 0;
    if (earned <= 0) {
      setError("No income available to claim.");
      return;
    }

    await handleAction(
      "Claim Income",
      "Claiming accrued rental income on Stellar...",
      () => ({
        ...property,
        earnedIncome: 0,
      }),
      async () => {
        const kit = getWalletKit();
        if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");

        // TODO: replace with real Soroban contract invocation XDR
        // Tracked in: [link to contract task]
        const mockXdr = "AAAAAgAAAAD5r+Hl5S94D......";
        await kit.signTransaction(mockXdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: viewerAddress!,
        });
      },
    );
  };

  const buyFromPlayer = async () => {
    await handleAction(
      "Buy Property",
      "Signing purchase on Stellar...",
      () => ({
        ...property,
        owner: viewerAddress!,
        isListed: false,
      }),
      async () => {
        const kit = getWalletKit();
        if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");

        // TODO: replace with real Soroban contract invocation XDR
        // Tracked in: [link to contract task]
        const mockXdr = "AAAAAgAAAAD5r+Hl5S94D......";
        await kit.signTransaction(mockXdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: viewerAddress!,
        });
      },
    );
  };

  return {
    buyFromTreasury,
    improveProperty,
    listForSale,
    claimIncome,
    buyFromPlayer,
    pendingAction,
    error,
    success,
    clearStates: () => {
      setError(null);
      setSuccess(null);
    },
  };
};
