"use client";

import { useEffect, useMemo, useState } from "react";
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

export interface WhitelistOnboardingWallet {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void> | void;
}

const KNOWN_ID_TYPES = ["passport", "national_id", "drivers_license"] as const;
type KnownIdType = (typeof KNOWN_ID_TYPES)[number];

function isKnownIdType(value: string): value is KnownIdType {
  return (KNOWN_ID_TYPES as readonly string[]).includes(value);
}

export function WhitelistOnboardingForm() {
  const { address, isConnected, connect } = useWallet();

  return (
    <WhitelistOnboardingFormView wallet={{ address, isConnected, connect }} />
  );
}

export function WhitelistOnboardingFormView({
  wallet,
}: {
  wallet: WhitelistOnboardingWallet;
}) {
  const { address, isConnected, connect } = wallet;
  const tPilot = useTranslations("Pilot");
  const t = useTranslations("Pilot.whitelistOnboarding");

  const steps = useMemo(
    () => [
      {
        id: "personal",
        title: t("steps.personal.title"),
        description: t("steps.personal.description"),
      },
      {
        id: "wallet",
        title: t("steps.wallet.title"),
        description: t("steps.wallet.description"),
      },
      {
        id: "review",
        title: t("steps.review.title"),
        description: t("steps.review.description"),
      },
    ],
    [t],
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<
    "none" | "pending" | "approved" | "rejected" | null
  >(null);
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
    void checkStatus();
  }, [isConnected, address]);

  const handleConnect = async () => {
    await connect();
    if (useAuthenticationStore.getState().isConnected) {
      setCurrentStep(2);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
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
      setError(err instanceof Error ? err.message : t("errors.submitFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const formatIdType = (value: string): string =>
    isKnownIdType(value)
      ? tPilot(`idTypes.${value}`)
      : value.replace(/_/g, " ");

  if (statusLoading) {
    return (
      <Card className="max-w-md w-full p-8 text-center bg-card/80 border-border">
        <div className="text-muted-foreground">{t("loadingStatus")}</div>
      </Card>
    );
  }

  if (requestStatus === "none" && !isStartingForm) {
    return (
      <div className="max-w-xl w-full">
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={{
            label: t("empty.action"),
            onClick: () => setIsStartingForm(true),
          }}
        />
      </div>
    );
  }

  if (requestStatus === "pending") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-card/80 border-border">
        <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("pending.title")}
        </h2>
        <p className="text-muted-foreground">{t("pending.description")}</p>
      </Card>
    );
  }

  if (requestStatus === "approved") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-card/80 border-border">
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("approved.title")}
        </h2>
        <p className="text-muted-foreground">{t("approved.description")}</p>
      </Card>
    );
  }

  if (requestStatus === "rejected") {
    return (
      <Card className="max-w-md w-full p-8 text-center space-y-4 bg-card/80 border-border">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileX2 size={32} aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t("rejected.title")}
        </h2>
        <p className="text-muted-foreground">{t("rejected.description")}</p>
        {rejectionReason && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-4 mt-4">
            <p className="text-red-400 text-sm font-medium">
              {t("rejected.reasonLabel")}
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
          {t("rejected.reapply")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl w-full p-6 sm:p-8 border-border bg-card/80 backdrop-blur-md">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-center text-sm">
          {t("subtitle")}
        </p>
      </div>

      <Stepper steps={steps} currentStep={currentStep} className="mb-8" />

      {error && (
        <div
          role="alert"
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
        >
          {error}
        </div>
      )}

      <div className="min-h-[200px]">
        {currentStep === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <Input
                id="whitelist-full-name"
                label={t("fields.fullName")}
                placeholder={t("fields.fullNamePlaceholder")}
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                leftIcon={<UserCircle className="w-4 h-4" aria-hidden="true" />}
              />
            </div>
            <div>
              <label
                htmlFor="whitelist-id-type"
                className="block text-xs font-medium text-neutral-400 mb-2"
              >
                {t("fields.idType")}
              </label>
              <select
                id="whitelist-id-type"
                className="w-full h-10 px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.idType}
                onChange={(e) =>
                  setFormData({ ...formData, idType: e.target.value })
                }
              >
                <option value="passport">{tPilot("idTypes.passport")}</option>
                <option value="national_id">
                  {tPilot("idTypes.national_id")}
                </option>
                <option value="drivers_license">
                  {tPilot("idTypes.drivers_license")}
                </option>
              </select>
            </div>
            <div>
              <Input
                id="whitelist-id-reference"
                label={t("fields.idReference")}
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
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Wallet
                className="w-8 h-8 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t("walletStep.title")}
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
              {t("walletStep.description")}
            </p>
            <Button
              onClick={handleConnect}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {t("walletStep.connect")}
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 text-foreground/80 text-sm">
            <div className="p-4 bg-background rounded-lg border border-border space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("summary.name")}
                </span>
                <span className="font-medium text-foreground">
                  {formData.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("summary.idType")}
                </span>
                <span className="font-medium text-foreground">
                  {formatIdType(formData.idType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("summary.idRef")}
                </span>
                <span className="font-medium text-foreground">
                  {formData.idReference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("summary.wallet")}
                </span>
                <span className="font-medium text-foreground truncate max-w-[200px]">
                  {address}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
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
          {t("actions.back")}
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            className="w-full"
            disabled={
              (currentStep === 0 &&
                (!formData.fullName || !formData.idReference)) ||
              (currentStep === 1 && !isConnected)
            }
          >
            {t("actions.continue")}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            className="w-full"
          >
            {t("actions.submit")}
          </Button>
        )}
      </div>
    </Card>
  );
}
