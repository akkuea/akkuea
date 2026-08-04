"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PropertyDetail } from "@/components/property";
import { InvestModal } from "@/components/marketplace/InvestModal";
import { Footer, Navbar } from "@/components/layout";
import {
  Button,
  Card,
  EmptyState,
  SectionErrorFallback,
} from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { useAsyncState } from "@/hooks/useAsyncState";
import { propertyApi } from "@/services/api/properties";
import { Building2, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PropertyPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const { isConnected, connect, address } = useWallet();
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);

  const fetchProperty = useCallback(
    () => propertyApi.getById(propertyId),
    [propertyId],
  );

  const {
    data: property,
    isLoading,
    isError,
    isEmpty,
    error,
    execute,
    retry,
  } = useAsyncState(fetchProperty, {
    isEmpty: (data) => data == null,
  });

  useEffect(() => {
    void execute();
  }, [execute]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Navbar />

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Link href="/marketplace">
            <Button variant="ghost" className="mb-6 gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>

          {isLoading && (
            <div
              className="space-y-6"
              aria-busy="true"
              aria-label="Loading property"
            >
              <Card className="h-96 animate-pulse bg-[#1a1a1a]" />
              <div className="space-y-3">
                <div className="h-8 w-1/3 animate-pulse rounded bg-[#1a1a1a]" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-[#1a1a1a]" />
              </div>
            </div>
          )}

          {isError && !isLoading && (
            <SectionErrorFallback
              message={error ?? "Error Loading Property"}
              onReset={() => void retry()}
            />
          )}

          {isEmpty && !isLoading && (
            <EmptyState
              title="Property not found"
              description="This property does not exist or is no longer available."
              icon={
                <Building2
                  className="w-5 h-5 text-neutral-500"
                  aria-hidden="true"
                />
              }
              action={{
                label: "Browse marketplace",
                onClick: () => router.push("/marketplace"),
              }}
            />
          )}

          {property && !isLoading && !isEmpty && (
            <div>
              <PropertyDetail
                property={property}
                onInvestClick={() => setIsInvestModalOpen(true)}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />

      {property && !isEmpty && (
        <InvestModal
          property={property}
          isOpen={isInvestModalOpen}
          onClose={() => setIsInvestModalOpen(false)}
          isConnected={isConnected}
          walletAddress={address}
          onConnectWallet={async () => {
            try {
              await connect?.();
            } catch (err) {
              console.error("Failed to connect wallet:", err);
            }
          }}
          onInvestmentSuccess={() => {
            setIsInvestModalOpen(false);
            void retry();
          }}
        />
      )}
    </div>
  );
}
