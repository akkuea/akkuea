import { useState } from "react";
import { GameProperty } from "../types/game.types";
import { getWalletKit } from "@/lib/walletKit";
import {
  buildBuyFromTreasuryXdr,
  buildBuyFromPlayerXdr,
  buildImprovePropertyXdr,
  buildListForSaleXdr,
  buildClaimIncomeXdr,
  submitSorobanTx,
  waitForSorobanTx,
  NETWORK_PASSPHRASE,
} from "@/lib/soroban-tx";

/** Stellar address used as the treasury in the game contract. */
const TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "GBTREASURY";

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

  /**
   * Sign a built XDR with the connected wallet and submit + wait for
   * confirmation via the Soroban RPC.
   *
   * Throws on signing failure, submission error, or on-chain failure.
   */
  const signAndSubmit = async (unsignedXdr: string): Promise<void> => {
    const kit = getWalletKit();
    if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");

    // Ask Freighter (or another wallet) to sign the transaction
    const { signedTxXdr } = await kit.signTransaction(unsignedXdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: viewerAddress!,
    });

    // Submit signed XDR to the Soroban RPC
    const txHash = await submitSorobanTx(signedTxXdr);

    // Poll until confirmed or failed (throws on failure)
    await waitForSorobanTx(txHash);
  };

  // ── Actions ──────────────────────────────────────────────────────────────

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
        const xdr = await buildBuyFromTreasuryXdr(
          viewerAddress!,
          property.id,
          TREASURY_ADDRESS,
        );
        await signAndSubmit(xdr);
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
        const xdr = await buildImprovePropertyXdr(viewerAddress!, property.id);
        await signAndSubmit(xdr);
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
        const xdr = await buildListForSaleXdr(
          viewerAddress!,
          property.id,
          price,
        );
        await signAndSubmit(xdr);
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
        const xdr = await buildClaimIncomeXdr(viewerAddress!, property.id);
        await signAndSubmit(xdr);
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
        const xdr = await buildBuyFromPlayerXdr(viewerAddress!, property.id);
        await signAndSubmit(xdr);
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
