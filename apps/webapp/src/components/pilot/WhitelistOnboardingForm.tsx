"use client";

import { useEffect, useState } from "react";
import { Stepper, Card, Input, Button, EmptyState } from "@/components/ui";
import { ShieldCheck, ShieldAlert, UserCircle, Wallet, FileX2 } from "lucide-react";
import { useWallet } from "@/components/auth/hooks";
import { apiClient } from "@/services/api/client";

const STEPS = [
  { id: "personal", title: "Personal Details", description: "Your name and ID type" },
  { id: "wallet", title: "Wallet Connection", description: "Connect Stellar address" },
  { id: "review", title: "Review", description: "Submit application" },
];

export function WhitelistOnboardingForm() {
  const { address, isConnected, connect } = useWallet();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "rejected" | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isStartingForm, setIsStartingForm] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    idType: "passport",
    idReference: "",
  });

  useEffect(() => {
    async function checkStatus() {
      if (!isConnected || !address) {
        setStatusLoading(false);
        setRequestStatus("none");
        return;
      }
      setStatusLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; status: string; rejectionReason?: string }>(`/pilot/whitelist/status/${address}`);
        if (res.data.success) {
          setRequestStatus(res.data.status as "none" | "pending" | "approved" | "rejected");
          if (res.data.status === "rejected" && res.data.rejectionReason) {
            setRejectionReason(res.data.rejectionReason);
          }
        }
      } catch (err) {
        console.error("Failed to check status", err);
      } finally {
        setStatusLoading(false);
      }
    }
    checkStatus();
  }, [isConnected, address]);

  // Auto-advance to step 2 when wallet connects on step 1.
  // Uses inline state setter to avoid adding handleNext to the deps array.
  useEffect(() => {
    if (isConnected && currentStep === 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isConnected, currentStep]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.post("/pilot/whitelist/request", {
        ...formData,
        walletAddress: address,
      });
      setRequestStatus("pending");
    } catch (err: any) {
      setError(err.message || "Failed to submit whitelist request");
    } finally {
      setIsLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <Card className="max-w-md w-full p-8 text-center bg-zinc-900/80 border-zinc-800">
        <div className="text-zinc-400">Loading your whitelist status...</div>
      </Card>
    );
  }

  if (requestStatus === "none" && !isStartingForm) {
    return (
      <div className="max-w-xl w-full">
        <EmptyState
          title="No Whitelist Application"
          description="You haven't submitted a whitelist application yet. Start your application to join the pilot."
          action={{
            label: "Start Application",
            onClick: () => setIsStartingForm(true),
          }}
        />
      </div>
    );
  }

  if (requestStatus === "pending") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-zinc-900/80 border-zinc-800">
        <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">Review Pending</h2>
        <p className="text-zinc-400">
          Your whitelist request is currently under review by the operator. Please check back later.
        </p>
      </Card>
    );
  }

  if (requestStatus === "approved") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-zinc-900/80 border-zinc-800">
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">You're Whitelisted!</h2>
        <p className="text-zinc-400">
          Your address has been approved for the pilot. You can now participate in offerings.
        </p>
      </Card>
    );
  }

  if (requestStatus === "rejected") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-zinc-900/80 border-zinc-800">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileX2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">Application Rejected</h2>
        <p className="text-zinc-400">
          Unfortunately, your whitelist application was rejected.
        </p>
        {rejectionReason && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-4 mt-4">
            <p className="text-red-400 text-sm font-medium">Reason:</p>
            <p className="text-red-300 text-sm">{rejectionReason}</p>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={() => {
            setRequestStatus("none");
            setRejectionReason(null);
            setIsStartingForm(true);
            setCurrentStep(0);
          }}
        >
          Re-apply
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl w-full p-6 sm:p-8 border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Investor Onboarding</h1>
        <p className="text-zinc-400 text-center text-sm">Pilot Program Whitelist Request</p>
      </div>

      <Stepper steps={STEPS} currentStep={currentStep} className="mb-8" />

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="min-h-[200px]">
        {currentStep === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Full Name</label>
              <Input
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                leftIcon={<UserCircle className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Government ID Type</label>
              <select
                className="w-full h-10 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={formData.idType}
                onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
              >
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="drivers_license">Driver's License</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">ID Reference Number</label>
              <Input
                placeholder="Document Number"
                value={formData.idReference}
                onChange={(e) => setFormData({ ...formData, idReference: e.target.value })}
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Connect Your Wallet</h3>
            <p className="text-zinc-400 text-sm text-center max-w-sm mb-6">
              Please connect your Stellar wallet to associate it with your whitelist application.
            </p>
            <Button onClick={connect} className="w-full sm:w-auto min-w-[200px]">
              Connect Wallet
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 text-zinc-300 text-sm">
            <div className="p-4 bg-zinc-950 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-500">Name</span>
                <span className="font-medium text-white">{formData.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID Type</span>
                <span className="font-medium text-white capitalize">{formData.idType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID Ref</span>
                <span className="font-medium text-white">{formData.idReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Wallet</span>
                <span className="font-medium text-white truncate max-w-[200px]">{address}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              By submitting this form, you confirm that the information provided is accurate and you agree to the pilot terms and conditions.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || isLoading}
          className="w-full"
        >
          Back
        </Button>
        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            className="w-full"
            disabled={
              (currentStep === 0 && (!formData.fullName || !formData.idReference)) ||
              (currentStep === 1 && !isConnected)
            }
          >
            Continue
          </Button>
        ) : (
          <Button onClick={handleSubmit} isLoading={isLoading} className="w-full">
            Submit Request
          </Button>
        )}
      </div>
    </Card>
  );
}
