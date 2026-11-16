"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
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

const KNOWN_ID_TYPES = ["passport", "national_id", "drivers_license"] as const;
type KnownIdType = (typeof KNOWN_ID_TYPES)[number];

function isKnownIdType(value: string): value is KnownIdType {
  return (KNOWN_ID_TYPES as readonly string[]).includes(value);
}

export function WhitelistReviewQueue() {
  const locale = useLocale();
  const tPilot = useTranslations("Pilot");
  const t = useTranslations("Pilot.whitelistReview");

  const [requests, setRequests] = useState<WhitelistRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal state
  const [selectedRequest, setSelectedRequest] =
    useState<WhitelistRequest | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await whitelistOperationsApi.getPendingWhitelist();
      setRequests(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.fetchFailed"));
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

  const formatIdType = (value: string): string =>
    isKnownIdType(value)
      ? tPilot(`idTypes.${value}`)
      : value.replace(/_/g, " ");

  const handleReviewAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;

    if (action === "reject" && !rejectionReason.trim()) {
      setReviewError(t("errors.reasonRequired"));
      return;
    }

    setIsReviewing(true);
    setReviewError(null);
    try {
      await whitelistOperationsApi.reviewWhitelistRequest(selectedRequest.id, {
        action,
        reason: action === "reject" ? rejectionReason : undefined,
      });

      setSelectedRequest(null);
      setRejectionReason("");
      void fetchRequests();
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error
          ? err.message
          : action === "approve"
            ? t("errors.approveFailed")
            : t("errors.rejectFailed"),
      );
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground">{t("loading")}</div>;
  }

  if (error) {
    return (
      <SectionErrorFallback
        message={t("errors.loadQueueFailed")}
        description={t("errors.loadQueueDescription")}
        retryLabel={t("actions.retry")}
        onReset={fetchRequests}
      />
    );
  }

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card
              key={req.id}
              className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/80 backdrop-blur-md"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-lg">
                    {req.fullName}
                  </h3>
                  <Badge variant="success">{t("card.statusPending")}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div className="text-muted-foreground">
                    {t("card.wallet")}
                  </div>
                  <div className="text-foreground/80 font-mono text-xs">
                    {req.walletAddress}
                  </div>

                  <div className="text-muted-foreground">
                    {t("card.idType")}
                  </div>
                  <div className="text-foreground/80">
                    {formatIdType(req.idType)}
                  </div>

                  <div className="text-muted-foreground">{t("card.idRef")}</div>
                  <div className="text-foreground/80">{req.idReference}</div>

                  <div className="text-muted-foreground">
                    {t("card.submitted")}
                  </div>
                  <div className="text-foreground/80">
                    {new Date(req.createdAt).toLocaleString(locale)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(req)}
                >
                  {t("card.review")}
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
          title={t("modal.title")}
          description={t("modal.description", {
            name: selectedRequest.fullName,
          })}
        >
          <div className="space-y-6 mt-4">
            <div className="bg-background p-4 rounded-lg border border-border space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">
                  {t("modal.fullName")}
                </span>
                <span className="font-medium text-foreground">
                  {selectedRequest.fullName}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">
                  {t("modal.walletAddress")}
                </span>
                <span className="font-mono text-foreground text-xs">
                  {selectedRequest.walletAddress}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">
                  {t("modal.idType")}
                </span>
                <span className="font-medium text-foreground">
                  {formatIdType(selectedRequest.idType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("modal.idReference")}
                </span>
                <span className="font-medium text-foreground">
                  {selectedRequest.idReference}
                </span>
              </div>
            </div>

            {reviewError && (
              <div
                role="alert"
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
              >
                {reviewError}
              </div>
            )}

            <div>
              <Input
                id="whitelist-rejection-reason"
                label={t("modal.rejectionReasonLabel")}
                placeholder={t("modal.rejectionReasonPlaceholder")}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="danger"
                onClick={() => void handleReviewAction("reject")}
                disabled={isReviewing || !rejectionReason.trim()}
                isLoading={isReviewing}
              >
                {t("actions.reject")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleReviewAction("approve")}
                disabled={isReviewing}
                isLoading={isReviewing}
              >
                {t("actions.approve")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
