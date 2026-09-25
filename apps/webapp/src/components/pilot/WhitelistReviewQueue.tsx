"use client";

import { useEffect, useState, useCallback } from "react";
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
import { useWallet } from "@/components/auth/hooks/useWallet.hook";
import { FileText, Eye, ExternalLink } from "lucide-react";

export function WhitelistReviewQueue() {
  const [requests, setRequests] = useState<WhitelistRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal state
  const [selectedRequest, setSelectedRequest] =
    useState<WhitelistRequest | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Document preview state
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const { address: operatorWallet } = useWallet();

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res =
        await whitelistOperationsApi.getPendingWhitelist(operatorWallet);
      setRequests(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch requests");
    } finally {
      setIsLoading(false);
    }
  }, [operatorWallet]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRequests();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRequests]);

  const handleViewDocument = async () => {
    if (!selectedRequest) return;

    setIsLoadingDocument(true);
    setDocumentError(null);
    setDocumentUrl(null);

    try {
      const res = await whitelistOperationsApi.getDocumentUrl(
        operatorWallet,
        selectedRequest.id,
      );
      setDocumentUrl(res.data.signedUrl);
    } catch (err: unknown) {
      setDocumentError(
        err instanceof Error ? err.message : "Failed to load document",
      );
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const handleReviewAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;

    if (action === "reject" && !rejectionReason.trim()) {
      setReviewError("A reason is required when rejecting a request.");
      return;
    }

    setIsReviewing(true);
    setReviewError(null);
    try {
      await whitelistOperationsApi.reviewWhitelistRequest(
        operatorWallet,
        selectedRequest.id,
        {
          action,
          reason: action === "reject" ? rejectionReason : undefined,
        },
      );

      // Refresh list
      setSelectedRequest(null);
      setRejectionReason("");
      setDocumentUrl(null);
      void fetchRequests();
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error ? err.message : `Failed to ${action} request`,
      );
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return <div className="text-zinc-400">Loading pending requests...</div>;
  }

  if (error) {
    return (
      <SectionErrorFallback
        message="Failed to load whitelist queue"
        onReset={fetchRequests}
      />
    );
  }

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <EmptyState
          title="No Pending Requests"
          description="There are no whitelist requests waiting for review in the queue."
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
                    Pending
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div className="text-zinc-500">Wallet:</div>
                  <div className="text-zinc-300 font-mono text-xs">
                    {req.walletAddress}
                  </div>

                  <div className="text-zinc-500">ID Type:</div>
                  <div className="text-zinc-300 capitalize">
                    {req.idType.replace("_", " ")}
                  </div>

                  <div className="text-zinc-500">ID Ref:</div>
                  <div className="text-zinc-300">{req.idReference}</div>

                  <div className="text-zinc-500">Submitted:</div>
                  <div className="text-zinc-300">
                    {new Date(req.createdAt).toLocaleString()}
                  </div>

                  {req.documentUrl && (
                    <>
                      <div className="text-zinc-500">Document:</div>
                      <div className="text-zinc-300 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>Attached</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(req)}
                >
                  Review
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
              setDocumentUrl(null);
              setDocumentError(null);
            }
          }}
          title="Review Whitelist Request"
          description={`Reviewing application for ${selectedRequest.fullName}`}
        >
          <div className="space-y-6 mt-4">
            <div className="bg-zinc-950 p-4 rounded-lg space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Full Name</span>
                <span className="font-medium text-white">
                  {selectedRequest.fullName}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Wallet Address</span>
                <span className="font-mono text-white text-xs">
                  {selectedRequest.walletAddress}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">ID Type</span>
                <span className="font-medium text-white capitalize">
                  {selectedRequest.idType.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">ID Reference Number</span>
                <span className="font-medium text-white">
                  {selectedRequest.idReference}
                </span>
              </div>
              {selectedRequest.documentUrl && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">ID Document</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleViewDocument}
                      disabled={isLoadingDocument}
                      className="h-8 px-3"
                    >
                      {isLoadingDocument ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          View Document
                        </>
                      )}
                    </Button>
                    {documentUrl && (
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {documentError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {documentError}
              </div>
            )}

            {documentUrl && (
              <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                <p className="text-zinc-400 text-sm mb-2">
                  Document preview (URL expires in 1 hour):
                </p>
                <div className="space-y-2">
                  {selectedRequest.documentUrl?.endsWith('.pdf') && (
                    <iframe
                      src={documentUrl}
                      className="w-full h-96 rounded border border-zinc-800"
                      title="ID Document Preview"
                    />
                  )}
                  {selectedRequest.documentUrl?.match(/\.(jpg|jpeg|png)$/i) && (
                    <img
                      src={documentUrl}
                      alt="ID Document"
                      className="max-w-full max-h-96 rounded border border-zinc-800"
                    />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  This is a time-limited signed URL. Do not share or save this link.
                </p>
              </div>
            )}

            {reviewError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {reviewError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">
                Rejection Reason (Optional)
              </label>
              <Input
                placeholder="Required if rejecting..."
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
                Reject Request
              </Button>
              <Button
                className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                onClick={() => handleReviewAction("approve")}
                disabled={isReviewing}
                isLoading={isReviewing}
              >
                Approve & Whitelist
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
