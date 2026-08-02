import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import { cn, formatDecimal, sumDecimals } from "../../../lib/utils";
import { useReferenceData } from "../../resources/reference-data";
import {
  useResourceDetail,
  useResourceMutations,
} from "../../resources/resource-api";

type LineKind = "account" | "item";

interface BillLine {
  id: number;
  kind: LineKind;
  accountId: string;
  itemId: string;
  description: string;
  quantity: string;
  rate: string;
  memo: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dueInThirtyDays() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function blankLine(): BillLine {
  return {
    id: Date.now() + Math.random(),
    kind: "account",
    accountId: "",
    itemId: "",
    description: "",
    quantity: "1",
    rate: "",
    memo: "",
  };
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  if (!/^\d*(\.\d{0,4})?$/.test(cleaned)) return value;
  return cleaned;
}

function lineAmount(line: BillLine) {
  const qty = line.quantity || "0";
  const rate = line.rate || "0";
  if (!Number(qty) || !Number(rate)) return "0";
  // Use decimal-safe multiply via scaled integers for the display total.
  const scale = 10_000n;
  const toMinor = (text: string) => {
    const [whole = "0", fraction = ""] = text.split(".");
    return BigInt(whole || "0") * scale + BigInt(fraction.padEnd(4, "0").slice(0, 4));
  };
  const product = (toMinor(qty) * toMinor(rate)) / scale;
  return `${product / scale}.${String(product % scale).padStart(4, "0")}`;
}

/**
 * QuickBooks Desktop-style Enter Bills: vendor header, then expense/item
 * lines with account or item, qty, rate, and amount.
 */
export function BillFormPage() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail("purchasing", "bills", editId);
  const mutations = useResourceMutations("purchasing", "bills");
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const vendorOptions = useMemo(
    () =>
      references.optionsFor({
        name: "vendorId",
        label: "Vendor",
        type: "select",
      }) ?? [],
    [references],
  );
  const accountOptions = useMemo(
    () => references.accountOptionsFor("accountId"),
    [references],
  );
  const itemOptions = references.itemOptions;

  const [vendorId, setVendorId] = useState("");
  const [billDate, setBillDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(dueInThirtyDays());
  const [vendorReference, setVendorReference] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<BillLine[]>(() =>
    Array.from({ length: 6 }, () => blankLine()),
  );
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveAndClose, setSaveAndClose] = useState(false);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setVendorId(String(data.vendorId ?? data.vendor ?? ""));
    setBillDate(String(data.billDate ?? todayIso()));
    setDueDate(String(data.dueDate ?? dueInThirtyDays()));
    setVendorReference(
      String(data.vendorReference ?? data.billNumber ?? data.reference ?? ""),
    );
    setTerms(String(data.terms ?? "Net 30"));
    setMemo(String(data.memo ?? ""));
    if (Array.isArray(data.lines) && data.lines.length) {
      setLines(
        (data.lines as Array<Record<string, unknown>>).map((line, index) => {
          const itemId = String(line.itemId ?? "");
          const accountId = String(line.accountId ?? "");
          return {
            id: Date.now() + index,
            kind: itemId ? ("item" as const) : ("account" as const),
            accountId,
            itemId,
            description: String(line.description ?? ""),
            quantity: String(line.quantity ?? "1"),
            rate: String(line.unitPrice ?? line.rate ?? ""),
            memo: String(line.memo ?? ""),
          };
        }),
      );
    }
  }, [detail.data, editId]);

  const amountDue = sumDecimals(lines.map((line) => lineAmount(line)));

  const updateLine = (id: number, patch: Partial<BillLine>) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.kind === "account") {
          next.itemId = "";
        }
        if (patch.kind === "item") {
          next.accountId = "";
        }
        if (patch.itemId !== undefined && patch.itemId) {
          const item = references.itemById.get(patch.itemId);
          if (item) {
            next.description =
              next.description || String(item.data.name ?? item.data.description ?? "");
            next.rate =
              next.rate ||
              String(item.data.purchaseCost ?? item.data.salesPrice ?? "");
            next.kind = "item";
            next.accountId = "";
          }
        }
        return next;
      }),
    );
  };

  const resetForm = () => {
    setVendorId("");
    setBillDate(todayIso());
    setDueDate(dueInThirtyDays());
    setVendorReference("");
    setTerms("Net 30");
    setMemo("");
    setLines(Array.from({ length: 6 }, () => blankLine()));
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
  };

  const save = async (closeAfter: boolean) => {
    if (!vendorId) {
      setMessage({
        title: "Vendor required",
        description: "Select the vendor this bill is from.",
        variant: "error",
      });
      return;
    }

    const filled = lines.filter((line) => {
      const hasTarget =
        (line.kind === "account" && line.accountId) ||
        (line.kind === "item" && line.itemId);
      return hasTarget && Number(line.rate) >= 0 && Number(line.quantity) > 0;
    });

    if (!filled.length) {
      setMessage({
        title: "Lines required",
        description: "Add at least one account or item line.",
        variant: "error",
      });
      return;
    }

    const data = {
      vendorId,
      billDate,
      dueDate,
      currency: references.baseCurrency || "USD",
      exchangeRate: "1",
      vendorReference: vendorReference || undefined,
      terms: terms || undefined,
      memo: memo || undefined,
      lines: filled.map((line) => ({
        ...(line.kind === "item"
          ? { itemId: line.itemId }
          : { accountId: line.accountId }),
        description:
          line.description ||
          line.memo ||
          (line.kind === "item" ? "Item" : "Expense"),
        quantity: line.quantity || "1",
        unitPrice: line.rate || "0",
      })),
    };

    setSaving(true);
    setSaveAndClose(closeAfter);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined) {
          throw new Error("Bill version is missing. Reload and try again.");
        }
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: "incomplete",
          idempotencyKey: idempotencyKey.current,
        });
      }

      setMessage({
        title: "Bill saved",
        description: closeAfter
          ? "Returning to the bills list."
          : "Saved. You can enter another bill.",
        variant: "success",
      });

      if (closeAfter) {
        window.setTimeout(() => {
          router.push("/purchasing/bills");
        }, 500);
      } else {
        resetForm();
      }
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this bill.",
        variant: "error",
      });
    } finally {
      setSaving(false);
      setSaveAndClose(false);
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
              href="/purchasing/bills"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to bills
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit bill" : "Enter bill"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e7] bg-white px-4 text-xs font-bold text-[#334b57]"
            >
              {saving && !saveAndClose ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
            >
              {saving && saveAndClose ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : null}
              Save & close
            </button>
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <Card className="mt-5 overflow-hidden p-0">
          <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] lg:col-span-2">
              Vendor
              <Select
                value={vendorId || undefined}
                onValueChange={setVendorId}
                options={vendorOptions}
                placeholder="Select vendor"
                allowAddNew
                addNewLabel="vendor"
                quickAddKind="vendor"
                onCreateOption={references.createOption}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Date
              <div className="mt-1.5">
                <DatePicker
                  value={billDate}
                  onChange={setBillDate}
                  className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </div>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Bill due
              <div className="mt-1.5">
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </div>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Ref. no.
              <input
                value={vendorReference}
                onChange={(event) => setVendorReference(event.target.value)}
                placeholder="Vendor invoice #"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Terms
              <Select
                value={terms}
                onValueChange={setTerms}
                options={["Due on receipt", "Net 15", "Net 30", "Net 60"]}
                searchable={false}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <div className="flex flex-col justify-end lg:col-span-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                Amount due
              </p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-[#142735]">
                {formatDecimal(amountDue)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#eef4f8] text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
                <tr>
                  <th className="w-28 px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Account / Item</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="w-24 px-3 py-2.5 text-right">Qty</th>
                  <th className="w-28 px-3 py-2.5 text-right">Rate</th>
                  <th className="w-28 px-3 py-2.5 text-right">Amount</th>
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
                        value={line.kind}
                        onValueChange={(value) =>
                          updateLine(line.id, {
                            kind: value as LineKind,
                          })
                        }
                        options={[
                          { label: "Expense", value: "account" },
                          { label: "Item", value: "item" },
                        ]}
                        searchable={false}
                        className="h-9 rounded-md border-[#b7c8d3] bg-white px-2 text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      {line.kind === "item" ? (
                        <Select
                          value={line.itemId || undefined}
                          onValueChange={(value) =>
                            updateLine(line.id, { itemId: value })
                          }
                          options={itemOptions}
                          placeholder="Select item"
                          allowAddNew
                          addNewLabel="item"
                          quickAddKind="item"
                          onCreateOption={references.createOption}
                          className="h-9 rounded-md border-[#b7c8d3] bg-white px-2 text-xs"
                        />
                      ) : (
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
                      )}
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.description}
                        onChange={(event) =>
                          updateLine(line.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Description"
                        className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-xs outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.id, {
                            quantity: moneyInput(event.target.value),
                          })
                        }
                        inputMode="decimal"
                        className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-right text-xs tabular-nums outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.rate}
                        onChange={(event) =>
                          updateLine(line.id, {
                            rate: moneyInput(event.target.value),
                          })
                        }
                        inputMode="decimal"
                        className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-right text-xs tabular-nums outline-none"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-[#243f4c]">
                      {Number(lineAmount(line)) > 0
                        ? formatDecimal(lineAmount(line))
                        : ""}
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        aria-label="Remove line"
                        disabled={lines.length <= 1}
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
                  <td colSpan={5} className="px-3 py-3">
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
                      Amount due
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(amountDue)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-[#e5ecf1] px-4 py-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Memo
              <input
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="Optional note for this bill"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
