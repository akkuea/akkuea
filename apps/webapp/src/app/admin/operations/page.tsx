"use client";

import { PropertyOperationsWorkspace } from "@/components/admin/operations/PropertyOperationsWorkspace";
import { useWallet } from "@/components/auth/hooks";

export default function AdminOperationsPage() {
  const { address, isConnected } = useWallet();

  return (
    <PropertyOperationsWorkspace
      operatorWallet={address ?? null}
      isWalletConnected={isConnected}
    />
  );
}
