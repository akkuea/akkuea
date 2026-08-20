"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Modal, Badge, EmptyState, SectionErrorFallback } from "@/components/ui";
import { apiClient } from "@/services/api/client";

type WhitelistRequest = {
  id: string;
  walletAddress: string;
  fullName: string;
  idType: string;
  idReference: string;
  status: string;
  createdAt: string;
};

export function WhitelistReviewQueue() {
  const [requests, setRequests] = useState<WhitelistRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal state
  const [selectedRequest, setSelectedRequest] = useState<WhitelistRequest | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: WhitelistRequest[] }>("/pilot/whitelist/pending");
      setRequests(res.data.data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReviewAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;
    
    if (action === "reject" && !rejectionReason.trim()) {
      setReviewError("A reason is required when rejecting a request.");
      return;
    }

    setIsReviewing(true);
    setReviewError(null);
    try {
      await apiClient.post(`/pilot/whitelist/${selectedRequest.id}/review`, {
        action,
        reason: action === "reject" ? rejectionReason : undefined,
      });
      
      // Refresh list
      setSelectedRequest(null);
      setRejectionReason("");
      fetchRequests();
    } catch (err: any) {
      setReviewError(err.message || `Failed to ${action} request`);
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
            <Card key={req.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 backdrop-blur-md">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-lg">{req.fullName}</h3>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                    Pending
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div className="text-zinc-500">Wallet:</div>
                  <div className="text-zinc-300 font-mono text-xs">{req.walletAddress}</div>
                  
                  <div className="text-zinc-500">ID Type:</div>
                  <div className="text-zinc-300 capitalize">{req.idType.replace('_', ' ')}</div>
                  
                  <div className="text-zinc-500">ID Ref:</div>
                  <div className="text-zinc-300">{req.idReference}</div>
                  
                  <div className="text-zinc-500">Submitted:</div>
                  <div className="text-zinc-300">{new Date(req.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={() => setSelectedRequest(req)}>
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
            }
          }}
          title="Review Whitelist Request"
          description={`Reviewing application for ${selectedRequest.fullName}`}
        >
          <div className="space-y-6 mt-4">
            <div className="bg-zinc-950 p-4 rounded-lg space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Full Name</span>
                <span className="font-medium text-white">{selectedRequest.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Wallet Address</span>
                <span className="font-mono text-white text-xs">{selectedRequest.walletAddress}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">ID Type</span>
                <span className="font-medium text-white capitalize">{selectedRequest.idType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID Reference Number</span>
                <span className="font-medium text-white">{selectedRequest.idReference}</span>
              </div>
            </div>

            {reviewError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {reviewError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Rejection Reason (Optional)</label>
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
