"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  Button,
  Input,
  Modal,
  Badge,
  EmptyState,
  SectionErrorFallback,
} from "@/components/ui";
import {
  whitelistOperationsApi,
  type WhitelistRequest,
} from "@/services/api/adminOperations";

export function WhitelistReviewQueue() {
  const t = useTranslations("Pilot.whitelist.review");
  const tIdType = useTranslations("Pilot.whitelist.onboarding.fields.idTypes");
  const [requests, setRequests] = useState<WhitelistRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal state
  const [selectedRequest, setSelectedRequest] =
    useState<WhitelistRequest | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const formatIdType = (value: string) => {
    switch (value) {
      case "passport":
      case "national_id":
      case "drivers_license":
        return tIdType(value);
      default:
        return value.replace(/_/g, " ");
    }
  };

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await whitelistOperationsApi.getPendingWhitelist();
      setRequests(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRequests();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRequests]);

  const handleReviewAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;

    if (action === "reject" && !rejectionReason.trim()) {
      setReviewError(t("reasonRequired"));
      return;
    }

    setIsReviewing(true);
    setReviewError(null);
    try {
      await whitelistOperationsApi.reviewWhitelistRequest(selectedRequest.id, {
        action,
        reason: action === "reject" ? rejectionReason : undefined,
      });

      // Refresh list
      setSelectedRequest(null);
      setRejectionReason("");
      void fetchRequests();
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error
          ? err.message
          : t(action === "reject" ? "rejectFailed" : "approveFailed"),
      );
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return <div className="text-zinc-400">{t("loading")}</div>;
  }

  if (error) {
    return (
      <SectionErrorFallback message={t("loadFailed")} onReset={fetchRequests} />
    );
  }

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card
              key={req.id}
              className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 backdrop-blur-md"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-lg">
                    {req.fullName}
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-emerald-400 border-emerald-400/30"
                  >
                    {t("pendingBadge")}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div className="text-zinc-500">{t("fields.wallet")}</div>
                  <div className="text-zinc-300 font-mono text-xs">
                    {req.walletAddress}
                  </div>

                  <div className="text-zinc-500">{t("fields.idType")}</div>
                  <div className="text-zinc-300 capitalize">
                    {formatIdType(req.idType)}
                  </div>

                  <div className="text-zinc-500">{t("fields.idReference")}</div>
                  <div className="text-zinc-300">{req.idReference}</div>

                  <div className="text-zinc-500">{t("fields.submitted")}</div>
                  <div className="text-zinc-300">
                    {new Date(req.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(req)}
                >
                  {t("reviewAction")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedRequest && (
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => {
            if (!isReviewing) {
              setSelectedRequest(null);
              setReviewError(null);
              setRejectionReason("");
            }
          }}
          title={t("modalTitle")}
          description={t("modalDescription", {
            name: selectedRequest.fullName,
          })}
        >
          <div className="space-y-6 mt-4">
            <div className="bg-zinc-950 p-4 rounded-lg space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">{t("fields.fullName")}</span>
                <span className="font-medium text-white">
                  {selectedRequest.fullName}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">
                  {t("fields.walletAddress")}
                </span>
                <span className="font-mono text-white text-xs">
                  {selectedRequest.walletAddress}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">{t("fields.idTypeModal")}</span>
                <span className="font-medium text-white capitalize">
                  {formatIdType(selectedRequest.idType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  {t("fields.idReferenceFull")}
                </span>
                <span className="font-medium text-white">
                  {selectedRequest.idReference}
                </span>
              </div>
            </div>

            {reviewError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {reviewError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                {t("rejectionReasonLabel")}
              </label>
              <Input
                placeholder={t("rejectionReasonPlaceholder")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                onClick={() => handleReviewAction("reject")}
                disabled={isReviewing || !rejectionReason.trim()}
                isLoading={isReviewing}
              >
                {t("reject")}
              </Button>
              <Button
                className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                onClick={() => handleReviewAction("approve")}
                disabled={isReviewing}
                isLoading={isReviewing}
              >
                {t("approve")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
