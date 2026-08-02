import { Link, useRouter } from "@/components/routing";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { ConfirmDeleteDialog } from "../../../components/ui/confirm-delete-dialog";
import { Skeleton } from "../../../components/ui/skeleton";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import { cn, formatDecimal, sumDecimals } from "../../../lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useReferenceData } from "../../resources/reference-data";
import {
  recordTitle,
  useResourceDetail,
  useResourceList,
  useResourceMutations,
} from "../../resources/resource-api";

function statusVariant(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized === "posted" || normalized === "active") return "success";
  if (normalized === "draft") return "warning";
  if (normalized === "reversed" || normalized === "void") return "danger";
  return "neutral";
}

function formatDate(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text || "—";
  const date = new Date(`${text.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * QuickBooks-style journal detail: header meta + debit/credit lines with
 * account names. The generic resource details page skips journal lines, so
 * this view exists specifically for that grid.
 */
export function JournalEntryDetailsPage({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detail = useResourceDetail("accounting", "journal-entries", id);
  const mutations = useResourceMutations("accounting", "journal-entries");
  const accounts = useResourceList("accounting", "chart-of-accounts", {
    page: 1,
    pageSize: 200,
  });
  const references = useReferenceData();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const accountLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of accounts.data?.data ?? []) {
      const number = String(record.data.accountNumber ?? "");
      const name = recordTitle(record);
      map.set(record.id, number ? `${number} — ${name}` : name);
    }
    return map;
  }, [accounts.data]);

  const record = detail.data?.data;
  const data = record?.data ?? {};
  const lines = Array.isArray(data.lines)
    ? (data.lines as Array<Record<string, unknown>>)
    : [];
  const currency = String(data.currency ?? "USD");
  const entryNo = String(
    data.journalNumber ?? data.documentNumber ?? record?.id?.slice(0, 8) ?? "—",
  );
  const debitTotal = sumDecimals(lines.map((line) => line.debit ?? "0"));
  const creditTotal = sumDecimals(lines.map((line) => line.credit ?? "0"));
  const balanced = debitTotal === creditTotal;
  const isDraft = record?.status === "draft";
  const isPosted = record?.status === "posted";

  const notify = (
    title: string,
    variant: ToastMessage["variant"] = "info",
    description?: string,
  ) => {
    setMessage({ title, variant, description });
    window.setTimeout(() => setMessage(null), 3200);
  };

  const postJournal = async () => {
    setBusy(true);
    try {
      await apiClient.action(
        `/v1/accounting/journal-entries/${encodeURIComponent(id)}/post`,
        undefined,
        "POST",
        `journal:${id}:post`,
      );
      await detail.refetch();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.resource("accounting", "journal-entries"),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.resource("accounting", "chart-of-accounts"),
      });
      notify("Journal posted", "success", `${entryNo} is in the general ledger.`);
    } catch (caught) {
      notify(
        "Post failed",
        "error",
        caught instanceof Error ? caught.message : "Could not post this journal.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (detail.isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1100px]">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-8 w-64" />
          <Card className="mt-5 overflow-hidden p-0">
            <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-4 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (detail.isError || !record) {
    return (
      <AppShell>
        <div className="p-12 text-center text-sm font-semibold text-red-600">
          {detail.error instanceof Error
            ? detail.error.message
            : "Journal entry not found"}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/accounting/journal-entries"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to journal entries
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
                Journal {entryNo}
              </h1>
              <Badge variant={statusVariant(record.status)}>
                {record.status}
              </Badge>
            </div>
            {data.memo ? (
              <p className="mt-1.5 text-sm font-semibold text-[#526a76]">
                {String(data.memo)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <>
                <Link
                  href={`/accounting/journal-entries/new?edit=${encodeURIComponent(id)}`}
                  className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e7] bg-white px-4 text-xs font-bold text-[#334b57]"
                >
                  <Pencil size={14} /> Edit
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void postJournal()}
                  className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Post
                </button>
              </>
            ) : null}
            {isPosted ? (
              <Link
                href={`/accounting/journal-entries/new?reverse=${encodeURIComponent(id)}`}
                className="flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-bold text-amber-800"
              >
                <RefreshCcw size={14} /> Reverse
              </Link>
            ) : null}
            {isDraft ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700"
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : null}
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <Card className="mt-5 overflow-hidden p-0">
          <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
            <Meta label="Entry no." value={entryNo} />
            <Meta label="Date" value={formatDate(data.journalDate)} />
            <Meta label="Currency" value={currency} />
            <Meta
              label="Exchange rate"
              value={String(data.exchangeRate ?? "1")}
            />
            <Meta
              label="Adjusting"
              value={data.adjustingEntry ? "Yes" : "No"}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-[#eef4f8] text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
                <tr>
                  <th className="px-3 py-2.5">Account</th>
                  <th className="w-36 px-3 py-2.5 text-right">
                    Debit ({currency})
                  </th>
                  <th className="w-36 px-3 py-2.5 text-right">
                    Credit ({currency})
                  </th>
                  <th className="px-3 py-2.5">Memo</th>
                </tr>
              </thead>
              <tbody>
                {lines.length ? (
                  lines.map((line, index) => {
                    const accountId = String(line.accountId ?? "");
                    const debit = String(line.debit ?? "0");
                    const credit = String(line.credit ?? "0");
                    const hasDebit = Number(debit) > 0;
                    const hasCredit = Number(credit) > 0;
                    return (
                      <tr
                        key={`${accountId}-${index}`}
                        className={cn(
                          "border-t border-[#e4ebf0]",
                          index % 2 === 0 ? "bg-white" : "bg-[#f3f8fc]",
                        )}
                      >
                        <td className="px-3 py-2.5 text-sm font-semibold text-[#243f4c]">
                          {accountLabel.get(accountId) ??
                            references.resolve(accountId)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-[#243f4c]">
                          {hasDebit ? formatDecimal(debit) : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-[#243f4c]">
                          {hasCredit ? formatDecimal(credit) : ""}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-[#526a76]">
                          {String(line.description ?? line.memo ?? "")}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-10 text-center text-sm font-semibold text-[#7a8d97]"
                    >
                      This journal has no lines.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#cfdce5] bg-[#f7fafc] text-xs font-bold text-[#243f4c]">
                  <td className="px-3 py-3">
                    Totals
                    <span
                      className={cn(
                        "ml-3 text-[11px] font-semibold",
                        balanced ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {balanced ? "In balance" : "Out of balance"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(debitTotal)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(creditTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {data.memo ? (
            <div className="border-t border-[#e5ecf1] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                Memo
              </p>
              <p className="mt-1 text-sm font-semibold text-[#405762]">
                {String(data.memo)}
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${entryNo}?`}
        recordName={`Journal ${entryNo}`}
        onConfirm={() => {
          void mutations.remove.mutateAsync(id).then(() => {
            router.push(
              `/accounting/journal-entries?deleted=${encodeURIComponent(entryNo)}`,
            );
          });
        }}
      />
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-bold text-[#29424e]">{value}</p>
    </div>
  );
}
