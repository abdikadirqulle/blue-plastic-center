import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import { cn, formatDecimal, sumDecimals } from "../../../lib/utils";
import { useReferenceData } from "../../resources/reference-data";
import {
  recordIdentifier,
  useResourceDetail,
  useResourceList,
  useResourceMutations,
} from "../../resources/resource-api";

interface PaymentAllocation {
  invoiceId: string;
  amount: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  if (!/^\d*(\.\d{0,4})?$/.test(cleaned)) return value;
  return cleaned;
}

const PAYMENT_METHODS = [
  "Cash",
  "Cheque",
  "Bank transfer",
  "Card",
  "Mobile money",
];

/**
 * QuickBooks Desktop-style Receive Payment: customer header fields, then a
 * grid of open invoices to apply the payment against.
 */
export function ReceivePaymentFormPage() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail("sales", "payments", editId);
  const mutations = useResourceMutations("sales", "payments");
  const invoices = useResourceList("sales", "invoices", {
    page: 1,
    pageSize: 200,
  });
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
  const depositOptions = useMemo(
    () => references.accountOptionsFor("depositToAccountId"),
    [references],
  );

  const [customerId, setCustomerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [depositToAccountId, setDepositToAccountId] = useState("");
  const [memo, setMemo] = useState("");
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveAndClose, setSaveAndClose] = useState(false);

  useEffect(() => {
    if (!depositToAccountId && depositOptions[0]) {
      setDepositToAccountId(depositOptions[0].value);
    }
  }, [depositOptions, depositToAccountId]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setCustomerId(String(data.customerId ?? data.customer ?? ""));
    setPaymentDate(String(data.paymentDate ?? todayIso()));
    setAmount(String(data.amount ?? ""));
    setPaymentMethod(String(data.paymentMethod ?? "Cash"));
    setReference(String(data.reference ?? ""));
    setDepositToAccountId(
      String(data.depositToAccountId ?? data.depositTo ?? ""),
    );
    setMemo(String(data.memo ?? ""));
    setAllocations(
      Array.isArray(data.allocations)
        ? (data.allocations as Array<Record<string, unknown>>)
            .map((allocation) => ({
              invoiceId: String(allocation.invoiceId ?? ""),
              amount: String(allocation.amount ?? ""),
            }))
            .filter((allocation) => allocation.invoiceId && allocation.amount)
        : [],
    );
  }, [detail.data, editId]);

  const openInvoices = useMemo(
    () =>
      (invoices.data?.data ?? []).filter((invoice) => {
        const balance = Number(invoice.data.balanceDue ?? 0);
        return (
          Boolean(customerId) &&
          invoice.data.customerId === customerId &&
          balance > 0 &&
          ["open", "partially_paid", "overdue"].includes(
            invoice.status.toLowerCase(),
          )
        );
      }),
    [invoices.data, customerId],
  );

  const appliedTotal = sumDecimals(
    allocations.map((allocation) => allocation.amount || "0"),
  );

  const selectCustomer = (value: string) => {
    setCustomerId(value);
    setAllocations([]);
  };

  const amountFor = (invoiceId: string) =>
    allocations.find((allocation) => allocation.invoiceId === invoiceId)
      ?.amount ?? "";

  const updateAllocation = (invoiceId: string, nextAmount: string) => {
    const cleaned = moneyInput(nextAmount);
    const previousApplied = sumDecimals(
      allocations.map((allocation) => allocation.amount || "0"),
    );
    const next = allocations.filter(
      (allocation) => allocation.invoiceId !== invoiceId,
    );
    if (cleaned && Number(cleaned) > 0) next.push({ invoiceId, amount: cleaned });
    setAllocations(next);
    const total = sumDecimals(next.map((entry) => entry.amount || "0"));
    if (
      !amount ||
      amount === previousApplied ||
      Number(amount) === Number(previousApplied)
    ) {
      if (Number(total) > 0) setAmount(total);
      else if (!cleaned) setAmount("");
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setPaymentDate(todayIso());
    setAmount("");
    setPaymentMethod("Cash");
    setReference("");
    setDepositToAccountId(depositOptions[0]?.value ?? "");
    setMemo("");
    setAllocations([]);
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
  };

  const save = async (closeAfter: boolean) => {
    if (!customerId) {
      setMessage({
        title: "Customer required",
        description: "Select the customer who paid.",
        variant: "error",
      });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setMessage({
        title: "Amount required",
        description: "Enter the payment amount received.",
        variant: "error",
      });
      return;
    }
    if (!depositToAccountId) {
      setMessage({
        title: "Deposit account required",
        description: "Choose where this payment is deposited.",
        variant: "error",
      });
      return;
    }

    const data = {
      customerId,
      paymentDate,
      amount,
      currency: references.baseCurrency || "USD",
      depositToAccountId,
      paymentMethod,
      reference: reference || undefined,
      memo: memo || undefined,
      allocations,
    };

    setSaving(true);
    setSaveAndClose(closeAfter);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined) {
          throw new Error("Payment version is missing. Reload and try again.");
        }
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: "draft",
          idempotencyKey: idempotencyKey.current,
        });
      }

      setMessage({
        title: "Payment saved",
        description: closeAfter
          ? "Returning to the payments list."
          : "Saved. You can receive another payment.",
        variant: "success",
      });

      if (closeAfter) {
        window.setTimeout(() => {
          router.push("/sales/payments");
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
            : "The API rejected this payment.",
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
              href="/sales/payments"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to payments
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit payment" : "Receive payment"}
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
              Save & new
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
          <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] xl:col-span-2">
              Customer
              <Select
                value={customerId || undefined}
                onValueChange={selectCustomer}
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
                  value={paymentDate}
                  onChange={setPaymentDate}
                  className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </div>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Amount
              <input
                value={amount}
                onChange={(event) => setAmount(moneyInput(event.target.value))}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Payment method
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                options={PAYMENT_METHODS}
                searchable={false}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Ref. no.
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Cheque / transfer #"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2 xl:col-span-2">
              Deposit to
              <Select
                value={depositToAccountId || undefined}
                onValueChange={setDepositToAccountId}
                options={depositOptions}
                placeholder="Select account"
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[#eef4f8] text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
                <tr>
                  <th className="w-16 px-3 py-2.5">Apply</th>
                  <th className="px-3 py-2.5">Invoice</th>
                  <th className="px-3 py-2.5">Due date</th>
                  <th className="px-3 py-2.5 text-right">Original amount</th>
                  <th className="px-3 py-2.5 text-right">Open balance</th>
                  <th className="w-36 px-3 py-2.5 text-right">Payment</th>
                </tr>
              </thead>
              <tbody>
                {!customerId ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm font-semibold text-[#7a8d97]"
                    >
                      Select a customer to view their open invoices.
                    </td>
                  </tr>
                ) : invoices.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm font-semibold text-[#7a8d97]"
                    >
                      Loading open invoices…
                    </td>
                  </tr>
                ) : !openInvoices.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm font-semibold text-[#7a8d97]"
                    >
                      This customer has no open invoices.
                    </td>
                  </tr>
                ) : (
                  openInvoices.map((invoice, index) => {
                    const paymentAmount = amountFor(invoice.id);
                    const openBalance = String(invoice.data.balanceDue ?? "0");
                    return (
                      <tr
                        key={invoice.id}
                        className={cn(
                          "border-t border-[#e4ebf0]",
                          index % 2 === 0 ? "bg-white" : "bg-[#f3f8fc]",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={Boolean(paymentAmount)}
                            onChange={(event) =>
                              updateAllocation(
                                invoice.id,
                                event.target.checked ? openBalance : "",
                              )
                            }
                            className="size-4 accent-[#007DCC]"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-sm font-bold text-[#007DCC]">
                          {recordIdentifier(invoice)}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-[#405762]">
                          {String(invoice.data.dueDate ?? "—")}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-[#243f4c]">
                          {formatDecimal(String(invoice.data.total ?? "0"))}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-[#243f4c]">
                          {formatDecimal(openBalance)}
                        </td>
                        <td className="p-1.5">
                          <input
                            aria-label={`Payment for ${recordIdentifier(invoice)}`}
                            value={paymentAmount}
                            onChange={(event) =>
                              updateAllocation(invoice.id, event.target.value)
                            }
                            inputMode="decimal"
                            className="h-9 w-full rounded-md border border-[#b7c8d3] bg-white px-2 text-right text-xs tabular-nums outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#cfdce5] bg-[#f7fafc] text-xs font-bold text-[#243f4c]">
                  <td colSpan={5} className="px-3 py-3 text-right">
                    Amounts applied
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(appliedTotal)}
                  </td>
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
                placeholder="Optional note"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
