import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
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

interface JournalLine {
  id: number;
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function blankLine(): JournalLine {
  return {
    id: Date.now() + Math.random(),
    accountId: "",
    debit: "",
    credit: "",
    memo: "",
  };
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  if (!/^\d*(\.\d{0,4})?$/.test(cleaned)) return value;
  return cleaned;
}

/**
 * QuickBooks-style journal entry: a short header, then a debit/credit grid
 * where every row picks an account from the full chart. No item lines.
 */
export function JournalEntryFormPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const reverseId = searchParams.get("reverse") ?? "";
  const detail = useResourceDetail(
    "accounting",
    "journal-entries",
    editId || reverseId,
  );
  const mutations = useResourceMutations("accounting", "journal-entries");
  const accounts = useResourceList("accounting", "chart-of-accounts", {
    page: 1,
    pageSize: 200,
  });
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const accountOptions = useMemo(
    () =>
      (accounts.data?.data ?? []).map((record) => {
        const number = String(record.data.accountNumber ?? "");
        const name = recordTitle(record);
        return {
          value: record.id,
          label: number ? `${number} — ${name}` : name,
        };
      }),
    [accounts.data],
  );

  const [journalDate, setJournalDate] = useState(todayIso());
  const [entryNo, setEntryNo] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [adjusting, setAdjusting] = useState(false);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<JournalLine[]>(() =>
    Array.from({ length: 8 }, () => blankLine()),
  );
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [postAfterSave, setPostAfterSave] = useState(false);

  useEffect(() => {
    if (references.baseCurrency) {
      setCurrency((current) =>
        current === "USD" ? references.baseCurrency : current,
      );
    }
  }, [references.baseCurrency]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${reverseId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setJournalDate(String(data.journalDate ?? data.date ?? todayIso()));
    setEntryNo(String(data.journalNumber ?? data.documentNumber ?? ""));
    setCurrency(
      String(data.currency ?? references.baseCurrency ?? "USD"),
    );
    setExchangeRate(String(data.exchangeRate ?? "1"));
    setAdjusting(Boolean(data.adjustingEntry));
    setMemo(String(data.memo ?? ""));
    if (Array.isArray(data.lines) && data.lines.length) {
      const mapped = (data.lines as Array<Record<string, unknown>>).map(
        (line, index) => ({
          id: Date.now() + index,
          accountId: String(line.accountId ?? ""),
          debit:
            reverseId && line.credit
              ? String(line.credit)
              : String(line.debit ?? ""),
          credit:
            reverseId && line.debit
              ? String(line.debit)
              : String(line.credit ?? ""),
          memo: String(line.description ?? line.memo ?? ""),
        }),
      );
      setLines(mapped.length >= 2 ? mapped : [...mapped, blankLine()]);
      if (reverseId) {
        setEntryNo("");
        setMemo(`Reversal of ${String(data.journalNumber ?? reverseId)}`);
        setJournalDate(todayIso());
      }
    }
  }, [detail.data, editId, reverseId, references.baseCurrency]);

  const debitTotal = sumDecimals(lines.map((line) => line.debit || "0"));
  const creditTotal = sumDecimals(lines.map((line) => line.credit || "0"));
  const balanced = debitTotal === creditTotal && Number(debitTotal) > 0;

  const updateLine = (id: number, patch: Partial<JournalLine>) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.debit !== undefined && patch.debit !== "") next.credit = "";
        if (patch.credit !== undefined && patch.credit !== "") next.debit = "";
        return next;
      }),
    );
  };

  const save = async (andPost: boolean) => {
    const filled = lines.filter(
      (line) =>
        line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0),
    );
    if (filled.length < 2) {
      setMessage({
        title: "Two lines required",
        description: "A journal needs at least one debit and one credit.",
        variant: "error",
      });
      return;
    }
    if (!balanced) {
      setMessage({
        title: "Out of balance",
        description: `Debits ${formatDecimal(debitTotal)} must equal credits ${formatDecimal(creditTotal)}.`,
        variant: "error",
      });
      return;
    }

    const data = {
      journalDate,
      journalNumber: entryNo || undefined,
      documentNumber: entryNo || undefined,
      currency,
      exchangeRate: exchangeRate || "1",
      adjustingEntry: adjusting,
      memo: memo || undefined,
      lines: filled.map((line) => ({
        accountId: line.accountId,
        debit: line.debit || "0",
        credit: line.credit || "0",
        description: line.memo || undefined,
      })),
    };

    setSaving(true);
    setPostAfterSave(andPost);
    try {
      let id = editId;
      if (editId && !reverseId) {
        const version = detail.data?.data.version;
        if (version === undefined) {
          throw new Error("Journal version is missing. Reload and try again.");
        }
        await mutations.update.mutateAsync({
          id: editId,
          data,
          version,
        });
      } else {
        const created = await mutations.create.mutateAsync({
          data,
          status: "draft",
          idempotencyKey: idempotencyKey.current,
        });
        id = created.data.id;
      }

      if (andPost && id) {
        await apiClient.action(
          `/v1/accounting/journal-entries/${encodeURIComponent(id)}/post`,
          undefined,
          "POST",
          `journal:${id}:post`,
        );
        await queryClient.invalidateQueries({
          queryKey: queryKeys.resource("accounting", "journal-entries"),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.resource("accounting", "chart-of-accounts"),
        });
      }

      setMessage({
        title: andPost ? "Journal posted" : "Journal saved",
        description: andPost
          ? "The entry is in the general ledger."
          : "Saved as a draft. Post when you are ready.",
        variant: "success",
      });
      window.setTimeout(() => {
        router.push(
          andPost && id
            ? `/accounting/journal-entries/${encodeURIComponent(id)}`
            : "/accounting/journal-entries",
        );
      }, 600);
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected the journal.",
        variant: "error",
      });
    } finally {
      setSaving(false);
      setPostAfterSave(false);
    }
  };

  return (
    <AppShell>
      <form
        className="mx-auto max-w-[1100px]"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/accounting/journal-entries"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to journal entries
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {reverseId
                ? "Reversing journal entry"
                : editId
                  ? "Edit journal entry"
                  : "New journal entry"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e7] bg-white px-4 text-xs font-bold text-[#334b57]"
            >
              {saving && !postAfterSave ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
            >
              {saving && postAfterSave ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : null}
              Save & post
            </button>
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <Card className="mt-5 overflow-hidden p-0">
          <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Currency
              <Select
                value={currency}
                onValueChange={setCurrency}
                options={["USD", "SOS", "EUR", "GBP"]}
                searchable={false}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Date
              <div className="mt-1.5">
                <DatePicker
                  value={journalDate}
                  onChange={setJournalDate}
                  className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </div>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Exchange rate
              <span className="mt-1.5 flex h-9 items-center gap-2 rounded-lg border border-[#c9d6df] bg-white px-2">
                <input
                  value={exchangeRate}
                  onChange={(event) =>
                    setExchangeRate(moneyInput(event.target.value))
                  }
                  className="w-full bg-transparent text-xs outline-none"
                />
                <span className="text-[10px] font-bold text-[#8a9ba5]">
                  {currency}
                </span>
              </span>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Entry no.
              <input
                value={entryNo}
                onChange={(event) => setEntryNo(event.target.value)}
                placeholder="Auto if blank"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-[#405762] lg:col-span-2">
              <input
                type="checkbox"
                checked={adjusting}
                onChange={(event) => setAdjusting(event.target.checked)}
                className="size-4 accent-[#007DCC]"
              />
              Adjusting entry
            </label>
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
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={line.id}
                    className={cn(
                      "border-t border-[#e4ebf0]",
                      index % 2 === 0 ? "bg-white" : "bg-[#f3f8fc]",
                    )}
                  >
                    <td className="p-1.5">
                      <Select
                        value={line.accountId || undefined}
                        onValueChange={(value) =>
                          updateLine(line.id, { accountId: value })
                        }
                        options={accountOptions}
                        placeholder="Select account"
                        allowAddNew
                        addNewLabel="account"
                        quickAddKind="account"
                        onCreateOption={references.createOption}
                        className="h-9 rounded-md border-[#b7c8d3] bg-white px-2 text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.debit}
                        onChange={(event) =>
                          updateLine(line.id, {
                            debit: moneyInput(event.target.value),
                          })
                        }
                        inputMode="decimal"
                        className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-right text-xs tabular-nums outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.credit}
                        onChange={(event) =>
                          updateLine(line.id, {
                            credit: moneyInput(event.target.value),
                          })
                        }
                        inputMode="decimal"
                        className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-right text-xs tabular-nums outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.memo}
                        onChange={(event) =>
                          updateLine(line.id, { memo: event.target.value })
                        }
                        placeholder="Memo"
                        className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-xs outline-none"
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        aria-label="Remove line"
                        disabled={lines.length <= 2}
                        onClick={() =>
                          setLines((current) =>
                            current.filter((entry) => entry.id !== line.id),
                          )
                        }
                        className="inline-flex size-8 items-center justify-center rounded-md text-[#8a9ba5] hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#cfdce5] bg-[#f7fafc] text-xs font-bold text-[#243f4c]">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) => [...current, blankLine()])
                      }
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#007DCC]"
                    >
                      <Plus size={14} /> Add lines
                    </button>
                    <span className="ml-4 text-[11px] font-semibold text-[#6f8390]">
                      Totals
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right tabular-nums",
                      !balanced && Number(debitTotal) > 0 && "text-amber-700",
                    )}
                  >
                    {formatDecimal(debitTotal)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right tabular-nums",
                      !balanced && Number(creditTotal) > 0 && "text-amber-700",
                    )}
                  >
                    {formatDecimal(creditTotal)}
                  </td>
                  <td
                    colSpan={2}
                    className="px-3 py-3 text-[11px] font-semibold text-[#6f8390]"
                  >
                    {balanced
                      ? "In balance"
                      : Number(debitTotal) || Number(creditTotal)
                        ? "Out of balance"
                        : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-[#e5ecf1] px-4 py-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Memo / description
              <input
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Optional note for the whole entry"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
