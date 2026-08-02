import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import {
  cn,
  formatDecimal,
  formatDecimalInput,
  sumDecimals,
} from "../../../lib/utils";
import { useReferenceData } from "../../resources/reference-data";
import {
  recordIdentifier,
  recordTitle,
  useResourceList,
  useResourceMutations,
} from "../../resources/resource-api";

interface BillPaymentAllocation {
  billId: string;
  vendorId: string;
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

const PAYMENT_METHODS = ["Cheque", "Cash", "Bank transfer", "Card", "ACH"];

/**
 * QuickBooks Desktop-style Pay Bills: select open bills, set payment account /
 * method / date, then pay selected.
 */
export function PayBillsFormPage() {
  const router = useRouter();
  const mutations = useResourceMutations("purchasing", "bill-payments");
  const bills = useResourceList("purchasing", "bills", {
    page: 1,
    pageSize: 200,
  });
  const vendors = useResourceList("purchasing", "vendors", {
    page: 1,
    pageSize: 200,
  });
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());

  const bankOptions = useMemo(
    () => references.accountOptionsFor("bankAccount"),
    [references],
  );
  const vendorName = useMemo(() => {
    const map = new Map<string, string>();
    for (const vendor of vendors.data?.data ?? []) {
      map.set(vendor.id, recordTitle(vendor));
    }
    return map;
  }, [vendors.data]);

  const [showAll, setShowAll] = useState(true);
  const [dueOnOrBefore, setDueOnOrBefore] = useState(todayIso());
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState("Cheque");
  const [bankAccount, setBankAccount] = useState("");
  const [reference, setReference] = useState("");
  const [allocations, setAllocations] = useState<BillPaymentAllocation[]>([]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bankAccount && bankOptions[0]) setBankAccount(bankOptions[0].value);
  }, [bankOptions, bankAccount]);

  const openBills = useMemo(() => {
    return (bills.data?.data ?? []).filter((bill) => {
      const due = Number(
        bill.data.balanceDue ?? bill.data.outstanding ?? bill.data.total ?? 0,
      );
      if (due <= 0) return false;
      if (["void", "voided", "paid", "cancelled"].includes(bill.status.toLowerCase()))
        return false;
      if (bill.status.toLowerCase() === "draft") return false;
      if (!showAll) {
        const dueDate = String(bill.data.dueDate ?? "").slice(0, 10);
        if (dueDate && dueDate > dueOnOrBefore) return false;
      }
      return true;
    });
  }, [bills.data, showAll, dueOnOrBefore]);

  const amountFor = (billId: string) =>
    allocations.find((entry) => entry.billId === billId)?.amount ?? "";

  const updateAllocation = (
    billId: string,
    vendorId: string,
    nextAmount: string,
  ) => {
    const cleaned = moneyInput(nextAmount);
    const next = allocations.filter((entry) => entry.billId !== billId);
    if (cleaned && Number(cleaned) > 0)
      next.push({ billId, vendorId, amount: cleaned });
    setAllocations(next);
  };

  const clearSelections = () => setAllocations([]);

  const totalToPay = sumDecimals(
    allocations.map((entry) => entry.amount || "0"),
  );
  const totalDue = sumDecimals(
    openBills.map((bill) =>
      String(bill.data.balanceDue ?? bill.data.outstanding ?? bill.data.total ?? "0"),
    ),
  );

  const paySelected = async () => {
    if (!bankAccount) {
      setMessage({
        title: "Payment account required",
        description: "Choose the bank or cash account to pay from.",
        variant: "error",
      });
      return;
    }
    if (!allocations.length) {
      setMessage({
        title: "Select bills",
        description: "Check at least one bill and enter an amount to pay.",
        variant: "error",
      });
      return;
    }

    const byVendor = new Map<string, BillPaymentAllocation[]>();
    for (const allocation of allocations) {
      const group = byVendor.get(allocation.vendorId) ?? [];
      group.push(allocation);
      byVendor.set(allocation.vendorId, group);
    }

    setSaving(true);
    try {
      let index = 0;
      for (const [vendorId, group] of byVendor) {
        await mutations.create.mutateAsync({
          data: {
            vendorId,
            bankAccount,
            paymentDate,
            paymentMethod,
            currency: references.baseCurrency || "USD",
            reference: reference || undefined,
            bills: group.map((entry) => ({
              billId: entry.billId,
              amount: entry.amount,
            })),
            totalPayment: sumDecimals(group.map((entry) => entry.amount)),
          },
          status: "incomplete",
          idempotencyKey: `${idempotencyKey.current}:${index}`,
        });
        index += 1;
      }
      setMessage({
        title: "Bills paid",
        description: `${allocations.length} bill(s) scheduled for payment.`,
        variant: "success",
      });
      window.setTimeout(() => router.push("/purchasing/bill-payments"), 600);
    } catch (caught) {
      setMessage({
        title: "Could not pay bills",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this payment.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/purchasing/bill-payments"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to pay bills
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              Pay bills
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/purchasing/bill-payments")}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e7] bg-white px-4 text-xs font-bold text-[#334b57]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void paySelected()}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
            >
              {saving ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : null}
              Pay selected bills
            </button>
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <Card className="mt-5 overflow-hidden p-0">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                Select bills to be paid
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#405762]">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!showAll}
                    onChange={() => setShowAll(false)}
                    className="accent-[#007DCC]"
                  />
                  Due on or before
                  <DatePicker
                    value={dueOnOrBefore}
                    onChange={setDueOnOrBefore}
                    className="h-8 w-36 rounded-md border-[#c9d6df] bg-white text-xs"
                  />
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={showAll}
                    onChange={() => setShowAll(true)}
                    className="accent-[#007DCC]"
                  />
                  Show all bills
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-[#eef4f8] text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
                <tr>
                  <th className="w-14 px-3 py-2.5">Pay</th>
                  <th className="px-3 py-2.5">Date due</th>
                  <th className="px-3 py-2.5">Vendor</th>
                  <th className="px-3 py-2.5">Ref. no.</th>
                  <th className="px-3 py-2.5 text-right">Amt. due</th>
                  <th className="w-36 px-3 py-2.5 text-right">Amt. to pay</th>
                </tr>
              </thead>
              <tbody>
                {bills.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm font-semibold text-[#7a8d97]"
                    >
                      Loading open bills…
                    </td>
                  </tr>
                ) : !openBills.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-sm font-semibold text-[#7a8d97]"
                    >
                      No open bills match this filter.
                    </td>
                  </tr>
                ) : (
                  openBills.map((bill, index) => {
                    const vendorId = String(bill.data.vendorId ?? "");
                    const due = String(
                      bill.data.balanceDue ??
                        bill.data.outstanding ??
                        bill.data.total ??
                        "0",
                    );
                    const payAmount = amountFor(bill.id);
                    return (
                      <tr
                        key={bill.id}
                        className={cn(
                          "border-t border-[#e4ebf0]",
                          index % 2 === 0 ? "bg-white" : "bg-[#f3f8fc]",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={Boolean(payAmount)}
                            onChange={(event) =>
                              updateAllocation(
                                bill.id,
                                vendorId,
                                event.target.checked
                                  ? formatDecimalInput(due)
                                  : "",
                              )
                            }
                            className="size-4 accent-[#007DCC]"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-sm text-[#405762]">
                          {String(bill.data.dueDate ?? "—")}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-[#243f4c]">
                          {vendorName.get(vendorId) ??
                            references.resolve(vendorId)}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-[#405762]">
                          {String(
                            bill.data.vendorReference ??
                              bill.data.documentNumber ??
                              recordIdentifier(bill),
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                          {formatDecimal(due)}
                        </td>
                        <td className="p-1.5">
                          <input
                            value={payAmount}
                            onChange={(event) =>
                              updateAllocation(
                                bill.id,
                                vendorId,
                                event.target.value,
                              )
                            }
                            onBlur={() => {
                              if (!payAmount) return;
                              updateAllocation(
                                bill.id,
                                vendorId,
                                formatDecimalInput(payAmount),
                              );
                            }}
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
                  <td colSpan={4} className="px-3 py-3">
                    <button
                      type="button"
                      onClick={clearSelections}
                      className="text-[11px] font-bold text-[#007DCC]"
                    >
                      Clear selections
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(totalDue)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDecimal(totalToPay)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid gap-3 border-t border-[#e5ecf1] bg-[#f7fafc] px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2 lg:col-span-4">
              Payment
            </p>
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
              Method
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                options={PAYMENT_METHODS}
                searchable={false}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Account
              <Select
                value={bankAccount || undefined}
                onValueChange={setBankAccount}
                options={bankOptions}
                placeholder="Select account"
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Ref. no.
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
