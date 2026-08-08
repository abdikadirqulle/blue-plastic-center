import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import { apiClient } from "../../../lib/api-client";
import { queryKeys } from "../../../lib/query-client";
import {
  cn,
  formatDecimal,
  formatDecimalInput,
  sumDecimals,
} from "../../../lib/utils";
import { useReferenceData } from "../../resources/reference-data";
import {
  useResourceDetail,
  useResourceMutations,
} from "../../resources/resource-api";

interface InvoiceLine {
  id: number;
  itemId: string;
  description: string;
  quantity: string;
  rate: string;
  unit: string;
}

type SaveMode = "stay" | "new" | "close";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dueInThirtyDays() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function blankLine(): InvoiceLine {
  return {
    id: Date.now() + Math.random(),
    itemId: "",
    description: "",
    quantity: "1",
    rate: "",
    unit: "Each",
  };
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  if (!/^\d*(\.\d{0,4})?$/.test(cleaned)) return value;
  return cleaned;
}

function lineAmount(line: InvoiceLine) {
  const qty = line.quantity || "0";
  const rate = line.rate || "0";
  if (!Number(qty) || !Number(rate)) return "0";
  const scale = 10_000n;
  const toMinor = (text: string) => {
    const [whole = "0", fraction = ""] = text.split(".");
    return (
      BigInt(whole || "0") * scale + BigInt(fraction.padEnd(4, "0").slice(0, 4))
    );
  };
  const product = (toMinor(qty) * toMinor(rate)) / scale;
  return `${product / scale}.${String(product % scale).padStart(4, "0")}`;
}

/**
 * QuickBooks Desktop-style Create Invoices: customer header, item grid,
 * and Save / Save & new / Save & close.
 */
export function InvoiceFormPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail("sales", "invoices", editId);
  const mutations = useResourceMutations("sales", "invoices");
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const customerOptions = useMemo(
    () =>
      references.optionsFor({
        name: "customerId",
        label: "Customer",
        type: "select",
      }) ?? [],
    [references],
  );
  const warehouseOptions = useMemo(
    () =>
      references.optionsFor({
        name: "warehouseId",
        label: "Warehouse",
        type: "select",
      }) ?? [],
    [references],
  );
  const receivableOptions = useMemo(
    () => references.accountOptionsFor("receivableAccountId"),
    [references],
  );

  const [customerId, setCustomerId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(dueInThirtyDays());
  const [warehouseId, setWarehouseId] = useState("");
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>(() =>
    Array.from({ length: 6 }, () => blankLine()),
  );
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("close");

  useEffect(() => {
    if (!warehouseId && warehouseOptions[0]) {
      setWarehouseId(
        typeof warehouseOptions[0] === "string"
          ? warehouseOptions[0]
          : warehouseOptions[0].value,
      );
    }
  }, [warehouseOptions, warehouseId]);

  useEffect(() => {
    if (!receivableAccountId && receivableOptions[0]) {
      setReceivableAccountId(receivableOptions[0].value);
    }
  }, [receivableOptions, receivableAccountId]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setCustomerId(String(data.customerId ?? data.customer ?? ""));
    setDocumentNumber(String(data.documentNumber ?? ""));
    setPoNumber(
      String(data.customerPurchaseOrder ?? data.poNumber ?? ""),
    );
    setInvoiceDate(String(data.invoiceDate ?? todayIso()));
    setDueDate(String(data.dueDate ?? dueInThirtyDays()));
    setMemo(String(data.memo ?? ""));
    setReceivableAccountId(String(data.receivableAccountId ?? ""));
    if (Array.isArray(data.lines) && data.lines.length) {
      const mapped = data.lines as Array<Record<string, unknown>>;
      const firstWarehouse = mapped.find((line) => line.warehouseId);
      if (firstWarehouse?.warehouseId)
        setWarehouseId(String(firstWarehouse.warehouseId));
      setLines(
        mapped.map((line, index) => ({
          id: Date.now() + index,
          itemId: String(line.itemId ?? line.accountId ?? ""),
          description: String(line.description ?? ""),
          quantity: String(line.quantity ?? "1"),
          rate: formatDecimalInput(String(line.unitPrice ?? line.rate ?? "")),
          unit: String(line.unit ?? "Each"),
        })),
      );
    }
  }, [detail.data, editId]);

  const total = sumDecimals(lines.map((line) => lineAmount(line)));

  const updateLine = (id: number, patch: Partial<InvoiceLine>) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.itemId) {
          const item = references.itemById.get(patch.itemId);
          if (item) {
            next.description = String(
              item.data.salesDescription ??
                item.data.description ??
                item.data.name ??
                next.description,
            );
            next.unit = String(item.data.unit ?? next.unit ?? "Each");
            next.rate = formatDecimalInput(
              String(item.data.salesPrice ?? next.rate),
            );
          }
        }
        return next;
      }),
    );
  };

  const resetForm = () => {
    setCustomerId("");
    setDocumentNumber("");
    setPoNumber("");
    setInvoiceDate(todayIso());
    setDueDate(dueInThirtyDays());
    setMemo("");
    setLines(Array.from({ length: 6 }, () => blankLine()));
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
    if (!editId) return;
    router.push("/sales/invoices/new");
  };

  const save = async (mode: SaveMode) => {
    if (!customerId) {
      setMessage({
        title: "Customer required",
        description: "Select the customer for this invoice.",
        variant: "error",
      });
      return;
    }
    const filled = lines.filter(
      (line) => line.itemId && Number(line.quantity) > 0,
    );
    if (!filled.length) {
      setMessage({
        title: "Items required",
        description: "Add at least one item line.",
        variant: "error",
      });
      return;
    }

    const data = {
      customerId,
      invoiceDate,
      dueDate,
      currency: references.baseCurrency || "USD",
      exchangeRate: "1",
      documentNumber: documentNumber || undefined,
      customerPurchaseOrder: poNumber || undefined,
      memo: memo || undefined,
      receivableAccountId: receivableAccountId || undefined,
      discountType: "none" as const,
      discountValue: "0",
      lines: filled.map((line) => ({
        itemId: line.itemId,
        description: line.description || "Item",
        quantity: line.quantity || "1",
        unitPrice: line.rate || "0",
        discountAmount: "0",
        taxRate: "0",
        unit: line.unit || undefined,
        ...(warehouseId ? { warehouseId } : {}),
      })),
    };

    setSaving(true);
    setSaveMode(mode);
    try {
      let id = editId;
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined) {
          throw new Error("Invoice version is missing. Reload and try again.");
        }
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        const created = await mutations.create.mutateAsync({
          data,
          status: "draft",
          idempotencyKey: idempotencyKey.current,
        });
        id = created.data.id;
      }

      await apiClient.action(
        `/v1/sales/invoices/${encodeURIComponent(id)}/post`,
        undefined,
        "POST",
        `${idempotencyKey.current}:post`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.resource("sales", "invoices") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.resource("sales", "customers") }),
      ]);

      setMessage({
        title: "Invoice saved",
        description:
          mode === "close"
            ? "Returning to the invoices list."
            : mode === "new"
              ? "Saved. Ready for another invoice."
              : "Invoice recorded.",
        variant: "success",
      });

      if (mode === "close") {
        window.setTimeout(() => {
          router.push(
            id
              ? `/sales/invoices/${encodeURIComponent(id)}`
              : "/sales/invoices",
          );
        }, 500);
      } else if (mode === "new") {
        resetForm();
      } else if (id) {
        router.push(`/sales/invoices/${encodeURIComponent(id)}`);
      }
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this invoice.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <form
        className="mx-auto max-w-[1100px]"
        onSubmit={(event) => {
          event.preventDefault();
          void save("stay");
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/sales/invoices"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to invoices
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit invoice" : "Create invoice"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e7] bg-white px-4 text-xs font-bold text-[#334b57]"
            >
              {saving && saveMode === "stay" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save("new")}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#007DCC] bg-white px-4 text-xs font-bold text-[#007DCC]"
            >
              {saving && saveMode === "new" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : null}
              Save & new
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save("close")}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
            >
              {saving && saveMode === "close" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : null}
              Save & close
            </button>
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <Card className="mt-5 overflow-hidden p-0">
          <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] lg:col-span-2">
              Customer:Job
              <Select
                value={customerId || undefined}
                onValueChange={setCustomerId}
                options={customerOptions}
                placeholder="Select customer"
                allowAddNew
                addNewLabel="customer"
                quickAddKind="customer"
                onCreateOption={references.createOption}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Date
              <div className="mt-1.5">
                <DatePicker
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                  className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </div>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Invoice no.
              <input
                value={documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
                placeholder="Auto if blank"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
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
              P.O. no.
              <input
                value={poNumber}
                onChange={(event) => setPoNumber(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Warehouse
              <Select
                value={warehouseId || undefined}
                onValueChange={setWarehouseId}
                options={warehouseOptions}
                placeholder="Select warehouse"
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Accounts receivable
              <Select
                value={receivableAccountId || undefined}
                onValueChange={setReceivableAccountId}
                options={receivableOptions}
                placeholder="AR account"
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-[#eef4f8] text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
                <tr>
                  <th className="px-3 py-2.5">Item</th>
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
                        value={line.itemId || undefined}
                        onValueChange={(value) =>
                          updateLine(line.id, { itemId: value })
                        }
                        options={references.itemOptions}
                        placeholder="Select item"
                        allowAddNew
                        addNewLabel="item"
                        quickAddKind="item"
                        onCreateOption={references.createOption}
                        className="h-9 rounded-md border-[#b7c8d3] bg-white px-2 text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={line.description}
                        onChange={(event) =>
                          updateLine(line.id, {
                            description: event.target.value,
                          })
                        }
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
                        onBlur={() => {
                          if (!line.rate) return;
                          updateLine(line.id, {
                            rate: formatDecimalInput(line.rate),
                          });
                        }}
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
                  <td colSpan={4} className="px-3 py-3">
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
                      Total
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(total)}
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
                placeholder="Customer-facing or internal note"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
