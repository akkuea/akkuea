"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileText,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Navbar } from "@/components/layout";
import { Badge, Button, Card } from "@/components/ui";
import { ConfirmReviewActionModal } from "@/components/admin/operations/ConfirmReviewActionModal";
import {
  adminOperationsApi,
  type OperationalPropertyDetail,
  type OperationalPropertyListItem,
  type OperationsQueue,
  type ReviewAction,
} from "@/services/api/adminOperations";
import { cn, formatCurrency, truncateAddress } from "@/lib/utils";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/animations";

const QUEUE_TABS: { id: OperationsQueue; label: string }[] = [
  { id: "pending", label: "Pending review" },
  { id: "changes", label: "Changes requested" },
  { id: "hold", label: "On hold" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function statusBadgeVariant(
  status: OperationalPropertyListItem["reviewStatus"],
): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "changes_requested":
    case "pending_review":
      return "warning";
    case "on_hold":
      return "info";
    default:
      return "default";
  }
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

interface PropertyOperationsWorkspaceProps {
  operatorWallet: string | null;
  isWalletConnected: boolean;
}

export function PropertyOperationsWorkspace({
  operatorWallet,
  isWalletConnected,
}: PropertyOperationsWorkspaceProps) {
  const [queue, setQueue] = useState<OperationsQueue>("pending");

  const selectQueue = (next: OperationsQueue) => {
    setQueue(next);
    setSelectedId(null);
    setPagination((p) => ({ ...p, page: 1 }));
  };
  const [items, setItems] = useState<OperationalPropertyListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OperationalPropertyDetail | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<ReviewAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const page = pagination.page;
  const limit = pagination.limit;

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await adminOperationsApi.listQueue(operatorWallet, {
        queue,
        page,
        limit,
      });
      setItems(res.data);
      setPagination((prev) => ({
        ...prev,
        ...res.pagination,
      }));
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setListLoading(false);
    }
  }, [operatorWallet, queue, page, limit]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await adminOperationsApi.getProperty(operatorWallet, id);
        setDetail(res.data);
      } catch (e) {
        setDetailError(
          e instanceof Error ? e.message : "Failed to load property",
        );
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [operatorWallet],
  );

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const onConfirmAction = async () => {
    if (!confirmAction || !selectedId || !operatorWallet) return;
    setSubmitting(true);
    try {
      const res = await adminOperationsApi.reviewProperty(
        operatorWallet,
        selectedId,
        {
          action: confirmAction,
          note: note.trim() || undefined,
          actorWallet: operatorWallet,
        },
      );
      setDetail(res.data);
      setConfirmAction(null);
      setNote("");
      await loadList();
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const readinessSummary = useMemo(() => {
    if (!detail) return null;
    const docs = detail.documents ?? [];
    const verifiedDocs = docs.filter((d) => d.verified).length;
    return {
      docsTotal: docs.length,
      verifiedDocs,
      kyc: detail.ownerKycStatus,
      valuation: detail.valuation.state,
    };
  }, [detail]);

  const accessBlocked = !isWalletConnected;
  const notAllowlisted =
    isWalletConnected && listError?.toLowerCase().includes("not authorized");

  return (
    <motion.div
      className="min-h-screen bg-black text-white"
      variants={pageTransition}
      initial="initial"
      animate="animate"
    >
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-amber-500/90">
              Internal operations
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
              Property verification
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Review tokenized inventory, valuation posture, and owner KYC
              before marketplace exposure. Critical actions require explicit
              confirmation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void loadList()}
              disabled={listLoading || accessBlocked}
            >
              Refresh queue
            </Button>
            <Link
              href="/marketplace"
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-[#1a1a1a] hover:text-white"
            >
              Exit to marketplace
            </Link>
          </div>
        </div>

        {accessBlocked && (
          <Card className="mb-8 border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-100">
                  Connect an authorized wallet
                </p>
                <p className="mt-1 text-sm text-amber-100/80">
                  Use the header wallet control to connect. Your address must be
                  on the operations allowlist for this environment.
                </p>
              </div>
            </div>
          </Card>
        )}

        {notAllowlisted && (
          <Card className="mb-8 border-red-500/30 bg-red-500/5 p-6">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 shrink-0 text-red-300" />
              <div>
                <p className="font-medium text-red-100">Access denied</p>
                <p className="mt-1 text-sm text-red-100/80">
                  This wallet is not permitted to use the operations dashboard.
                  Contact platform administrators if you believe this is an
                  error.
                </p>
              </div>
            </div>
          </Card>
        )}

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-8 lg:grid-cols-5"
        >
          <motion.section variants={staggerItem} className="lg:col-span-2">
            <Card className="overflow-hidden border-zinc-800 bg-zinc-950/80 p-0">
              <div className="flex flex-wrap gap-1 border-b border-zinc-800 p-2">
                {QUEUE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectQueue(tab.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      queue === tab.id
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {listLoading && (
                  <p className="p-6 text-sm text-zinc-500">Loading queue…</p>
                )}
                {listError && !listLoading && (
                  <p className="p-6 text-sm text-red-300">{listError}</p>
                )}
                {!listLoading && !listError && items.length === 0 && (
                  <p className="p-6 text-sm text-zinc-500">
                    No properties in this queue.
                  </p>
                )}
                {!listLoading &&
                  !listError &&
                  items.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "flex w-full flex-col gap-2 border-b border-zinc-800/80 px-4 py-3 text-left transition-colors hover:bg-zinc-900/80",
                        selectedId === row.id && "bg-zinc-900",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-zinc-100">
                          {row.name}
                        </span>
                        <Badge
                          variant={statusBadgeVariant(row.reviewStatus)}
                          className="shrink-0"
                        >
                          {formatStatusLabel(row.reviewStatus)}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {row.city}, {row.country} · Owner{" "}
                        {truncateAddress(row.ownerWallet)}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                        <span>KYC: {row.ownerKycStatus}</span>
                        <span>·</span>
                        <span>Valuation: {row.valuationState}</span>
                        <span>·</span>
                        <span>Docs: {row.documentCount}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </Card>
          </motion.section>

          <motion.section variants={staggerItem} className="lg:col-span-3">
            {!selectedId && (
              <Card className="flex min-h-[320px] flex-col items-center justify-center border-dashed border-zinc-700 bg-zinc-950/40 p-8 text-center">
                <Building2 className="mb-3 h-10 w-10 text-zinc-600" />
                <p className="text-sm text-zinc-500">
                  Select a property from the queue to see audit context,
                  documents, and actions.
                </p>
              </Card>
            )}
            {selectedId && detailLoading && (
              <p className="text-sm text-zinc-500">Loading property detail…</p>
            )}
            {selectedId && detailError && !detailLoading && (
              <Card className="border-red-500/30 bg-red-500/5 p-6 text-sm text-red-200">
                {detailError}
              </Card>
            )}
            {detail && !detailLoading && (
              <div className="space-y-4">
                <Card className="border-zinc-800 bg-zinc-950/80 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {detail.name}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {detail.location.city}, {detail.location.country} ·
                        Listed {new Date(detail.listedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={detail.verified ? "success" : "warning"}>
                        {detail.verified
                          ? "Verified (marketplace)"
                          : "Not verified"}
                      </Badge>
                      <Badge variant={statusBadgeVariant(detail.reviewStatus)}>
                        {formatStatusLabel(detail.reviewStatus)}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    {detail.description}
                  </p>
                  <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-zinc-500">Total value</dt>
                      <dd className="font-medium text-zinc-100">
                        {formatCurrency(parseFloat(detail.totalValue))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Price / share</dt>
                      <dd className="font-medium text-zinc-100">
                        {formatCurrency(parseFloat(detail.pricePerShare))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Owner wallet</dt>
                      <dd className="font-mono text-xs text-zinc-300">
                        {detail.owner}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Token</dt>
                      <dd className="font-mono text-xs text-zinc-300">
                        {detail.tokenAddress ?? "Not tokenized"}
                      </dd>
                    </div>
                  </dl>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950/80 p-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                    <ClipboardList className="h-4 w-4 text-amber-500" />
                    Readiness &amp; audit context
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                    <li>
                      <span className="text-zinc-500">Owner KYC: </span>
                      {detail.ownerKycStatus} ({detail.ownerKycTier})
                    </li>
                    <li>
                      <span className="text-zinc-500">Valuation: </span>
                      {detail.valuation.state}
                      {detail.valuation.record?.price != null && (
                        <span className="text-zinc-500">
                          {" "}
                          — {formatCurrency(detail.valuation.record.price)}{" "}
                          {detail.valuation.record.currency}
                        </span>
                      )}
                    </li>
                    {readinessSummary && (
                      <li>
                        <span className="text-zinc-500">Documents: </span>
                        {readinessSummary.verifiedDocs}/
                        {readinessSummary.docsTotal} verified on file
                      </li>
                    )}
                    <li>
                      <span className="text-zinc-500">Last reviewer: </span>
                      {detail.audit.lastActorWallet
                        ? truncateAddress(detail.audit.lastActorWallet)
                        : "—"}
                      {detail.audit.lastActionAt && (
                        <span className="text-zinc-600">
                          {" "}
                          ·{" "}
                          {new Date(detail.audit.lastActionAt).toLocaleString()}
                        </span>
                      )}
                    </li>
                    {detail.audit.lastNote && (
                      <li>
                        <span className="text-zinc-500">Last note: </span>
                        {detail.audit.lastNote}
                      </li>
                    )}
                  </ul>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950/80 p-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                    <FileText className="h-4 w-4 text-amber-500" />
                    Documents
                  </h3>
                  <ul className="mt-4 divide-y divide-zinc-800">
                    {(detail.documents ?? []).length === 0 && (
                      <li className="py-2 text-sm text-zinc-500">
                        No documents uploaded.
                      </li>
                    )}
                    {(detail.documents ?? []).map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                      >
                        <span className="text-zinc-200">{doc.name}</span>
                        <span className="text-xs text-zinc-500">
                          {doc.type}
                        </span>
                        <Badge variant={doc.verified ? "success" : "warning"}>
                          {doc.verified ? "Verified" : "Pending"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950/80 p-6">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Operational note
                  </h3>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Optional context recorded with the next action (audit trail)."
                    className="mt-3 w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={!operatorWallet || submitting}
                      onClick={() => setConfirmAction("approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!operatorWallet || submitting}
                      onClick={() => setConfirmAction("request_changes")}
                    >
                      Request changes
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!operatorWallet || submitting}
                      onClick={() => setConfirmAction("hold")}
                    >
                      Hold
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-300 hover:text-red-200"
                      disabled={!operatorWallet || submitting}
                      onClick={() => setConfirmAction("reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </motion.section>
        </motion.div>
      </main>

      <ConfirmReviewActionModal
        isOpen={confirmAction !== null}
        action={confirmAction}
        propertyName={detail?.name ?? ""}
        isSubmitting={submitting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void onConfirmAction()}
      />
    </motion.div>
  );
}
