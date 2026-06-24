"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { PropertyDetail } from "@/components/property";
import { InvestModal } from "@/components/marketplace/InvestModal";
import { Footer, Navbar } from "@/components/layout";
import { Button, Card } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { propertyApi } from "@/services/api/properties";
import { AlertCircle, ChevronLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function PropertyPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const { isConnected, connect, address } = useWallet();
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);

  useEffect(() => {
    const loadProperty = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await propertyApi.getById(propertyId);
        setProperty(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load property",
        );
        setProperty(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadProperty();
  }, [propertyId]);

  const handleRetry = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await propertyApi.getById(propertyId);
      setProperty(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load property");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Navbar />

      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          {/* Back Button */}
          <Link href="/marketplace">
            <Button variant="ghost" className="mb-6 gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>

          {isLoading && (
            <div className="space-y-6">
              <Card className="h-96 animate-pulse bg-[#1a1a1a]" />
              <div className="space-y-3">
                <div className="h-8 w-1/3 animate-pulse rounded bg-[#1a1a1a]" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-[#1a1a1a]" />
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
              <div className="mb-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-red-200">
                  Error Loading Property
                </h3>
              </div>
              <p className="mb-4 text-sm text-red-100/80">{error}</p>
              <Button onClick={handleRetry} variant="ghost" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          )}

          {property && !isLoading && (
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

      {property && (
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
            handleRetry();
          }}
        />
      )}
    </div>
  );
}
