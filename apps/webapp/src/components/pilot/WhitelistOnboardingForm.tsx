"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Stepper, Card, Input, Button, EmptyState } from "@/components/ui";
import {
  ShieldCheck,
  ShieldAlert,
  UserCircle,
  Wallet,
  FileX2,
} from "lucide-react";
import { useWallet } from "@/components/auth/hooks";
import { apiClient } from "@/services/api/client";
import { useAuthenticationStore } from "@/components/auth/store/data/slices/authentication.slice";

const STEP_KEYS = ["personal", "wallet", "review"] as const;

type IdType = "passport" | "national_id" | "drivers_license";

export function WhitelistOnboardingForm() {
  const t = useTranslations("Pilot.whitelist.onboarding");
  const { address, isConnected, connect } = useWallet();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<
    "none" | "pending" | "approved" | "rejected" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isStartingForm, setIsStartingForm] = useState(false);

  const [formData, setFormData] = useState<{
    fullName: string;
    idType: IdType;
    idReference: string;
  }>({
    fullName: "",
    idType: "passport",
    idReference: "",
  });

  const steps = STEP_KEYS.map((id) => ({
    id,
    title: t(`steps.${id}.title`),
    description: t(`steps.${id}.description`),
  }));

  useEffect(() => {
    async function checkStatus() {
      if (!isConnected || !address) {
        setStatusLoading(false);
        setRequestStatus("none");
        return;
      }
      setStatusLoading(true);
      try {
        const res = await apiClient.get<{
          success: boolean;
          status: string;
          rejectionReason?: string;
        }>(`/pilot/whitelist/status/${address}`);
        if (res.data.success) {
          setRequestStatus(
            res.data.status as "none" | "pending" | "approved" | "rejected",
          );
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

  const handleConnect = async () => {
    await connect();
    if (useAuthenticationStore.getState().isConnected) {
      setCurrentStep(2);
    }
  };

  const handleNext = () => {
    if (currentStep < STEP_KEYS.length - 1) {
      // Skip the wallet step when a session already exists. Back from review
      // still returns to the wallet step and stays there.
      setCurrentStep((prev) => (prev === 0 && isConnected ? 2 : prev + 1));
    }
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("submitFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <Card className="max-w-md w-full p-8 text-center bg-zinc-900/80 border-zinc-800">
        <div className="text-zinc-400">{t("statusLoading")}</div>
      </Card>
    );
  }

  if (requestStatus === "none" && !isStartingForm) {
    return (
      <div className="max-w-xl w-full">
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={{
            label: t("startApplication"),
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
        <h2 className="text-2xl font-bold text-white">{t("pendingTitle")}</h2>
        <p className="text-zinc-400">{t("pendingDescription")}</p>
      </Card>
    );
  }

  if (requestStatus === "approved") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-zinc-900/80 border-zinc-800">
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">{t("approvedTitle")}</h2>
        <p className="text-zinc-400">{t("approvedDescription")}</p>
      </Card>
    );
  }

  if (requestStatus === "rejected") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-zinc-900/80 border-zinc-800">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileX2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white">{t("rejectedTitle")}</h2>
        <p className="text-zinc-400">{t("rejectedDescription")}</p>
        {rejectionReason && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-4 mt-4">
            <p className="text-red-400 text-sm font-medium">
              {t("rejectionReasonLabel")}
            </p>
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
          {t("reapply")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl w-full p-6 sm:p-8 border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {t("title")}
        </h1>
        <p className="text-zinc-400 text-center text-sm">{t("subtitle")}</p>
      </div>

      <Stepper steps={steps} currentStep={currentStep} className="mb-8" />

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="min-h-[200px]">
        {currentStep === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                {t("fields.fullName")}
              </label>
              <Input
                placeholder={t("fields.fullNamePlaceholder")}
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                leftIcon={<UserCircle className="w-4 h-4" />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                {t("fields.idType")}
              </label>
              <select
                className="w-full h-10 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={formData.idType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    idType: e.target.value as IdType,
                  })
                }
              >
                <option value="passport">{t("fields.idTypes.passport")}</option>
                <option value="national_id">
                  {t("fields.idTypes.national_id")}
                </option>
                <option value="drivers_license">
                  {t("fields.idTypes.drivers_license")}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                {t("fields.idReference")}
              </label>
              <Input
                placeholder={t("fields.idReferencePlaceholder")}
                value={formData.idReference}
                onChange={(e) =>
                  setFormData({ ...formData, idReference: e.target.value })
                }
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {t("walletStepTitle")}
            </h3>
            <p className="text-zinc-400 text-sm text-center max-w-sm mb-6">
              {t("walletStepDescription")}
            </p>
            <Button
              onClick={handleConnect}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {t("connectWallet")}
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 text-zinc-300 text-sm">
            <div className="p-4 bg-zinc-950 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-500">{t("summary.name")}</span>
                <span className="font-medium text-white">
                  {formData.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{t("summary.idType")}</span>
                <span className="font-medium text-white">
                  {t(`fields.idTypes.${formData.idType}`)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  {t("summary.idReference")}
                </span>
                <span className="font-medium text-white">
                  {formData.idReference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{t("summary.wallet")}</span>
                <span className="font-medium text-white truncate max-w-[200px]">
                  {address}
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              {t("summary.disclaimer")}
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
          {t("back")}
        </Button>
        {currentStep < STEP_KEYS.length - 1 ? (
          <Button
            onClick={handleNext}
            className="w-full"
            disabled={
              (currentStep === 0 &&
                (!formData.fullName || !formData.idReference)) ||
              (currentStep === 1 && !isConnected)
            }
          >
            {t("continue")}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            className="w-full"
          >
            {t("submit")}
          </Button>
        )}
      </div>
    </Card>
  );
}
