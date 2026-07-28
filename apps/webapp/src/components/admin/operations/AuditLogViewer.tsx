"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { cn, truncateAddress } from "@/lib/utils";
import { pageTransition } from "@/lib/animations";

export interface AuditLogEntry {
  id: string;
  actor: string;
  actionType: string;
  timestamp: string;
  details?: Record<string, unknown>;
  targetResource?: string;
  targetId?: string;
}

interface AuditLogResponse {
  success: boolean;
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuditLogViewerProps {
  operatorWallet: string | null;
  isWalletConnected: boolean;
}

export function AuditLogViewer({
  operatorWallet,
  isWalletConnected,
}: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters and Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filterActor, setFilterActor] = useState("");
  const [filterActionType, setFilterActionType] = useState("");

  // debounced inputs
  const [debouncedActor, setDebouncedActor] = useState("");
  const [debouncedActionType, setDebouncedActionType] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedActor(filterActor);
      setDebouncedActionType(filterActionType);
      setPage(1); // reset to page 1 on filter change
    }, 500);
    return () => clearTimeout(timer);
  }, [filterActor, filterActionType]);

  const fetchLogs = useCallback(async () => {
    if (!operatorWallet) return;

    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      searchParams.set("page", page.toString());
      searchParams.set("limit", limit.toString());
      if (debouncedActor) searchParams.set("actor", debouncedActor);
      if (debouncedActionType)
        searchParams.set("actionType", debouncedActionType);

      const res = await fetch(
        `/api/v1/admin/audit-log?${searchParams.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-operator-wallet": operatorWallet,
          },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const json = (await res.json()) as AuditLogResponse;
      if (json.success) {
        setLogs(json.data);
        setTotal(json.pagination.total);
        setTotalPages(json.pagination.totalPages);
      } else {
        throw new Error("Failed to fetch audit logs");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [operatorWallet, page, limit, debouncedActor, debouncedActionType]);

  useEffect(() => {
    if (isWalletConnected && operatorWallet) {
      const timer = setTimeout(() => {
        void fetchLogs();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [fetchLogs, isWalletConnected, operatorWallet]);

  if (!isWalletConnected) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5 p-6">
        <p className="font-medium text-amber-100">
          Connect an authorized wallet to view audit logs
        </p>
      </Card>
    );
  }

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <Card className="border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative max-w-xs flex-1">
              <input
                type="text"
                placeholder="Filter by Actor (Wallet)..."
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="relative max-w-xs flex-1">
              <input
                type="text"
                placeholder="Filter by Action Type..."
                value={filterActionType}
                onChange={(e) => setFilterActionType(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            }
            onClick={() => void fetchLogs()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-zinc-800 bg-zinc-950/80 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Actor</th>
                <th className="px-6 py-3 font-medium">Action Type</th>
                <th className="px-6 py-3 font-medium">Target</th>
                <th className="px-6 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading && logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    Loading audit logs...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-red-400"
                  >
                    {error}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/50">
                    <td className="whitespace-nowrap px-6 py-4">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-zinc-300">
                      {truncateAddress(log.actor)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant="default">{log.actionType}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {log.targetResource ? (
                        <span className="text-zinc-300">
                          {log.targetResource}{" "}
                          {log.targetId ? `(${log.targetId})` : ""}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {log.details ? (
                        <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-2 font-mono text-[10px] text-zinc-400">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
            <span className="text-xs text-zinc-500">
              Showing page {page} of {totalPages} ({total} total records)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
