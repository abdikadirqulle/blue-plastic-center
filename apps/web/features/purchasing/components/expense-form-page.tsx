import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import { useReferenceData } from "../../resources/reference-data";
import {
  useResourceDetail,
  useResourceMutations,
} from "../../resources/resource-api";

type SaveMode = "new" | "close";

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
 * QuickBooks Desktop-style Write Check / Expense: payee, payment account,
 * expense account, amount.
 */
export function ExpenseFormPage() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail("purchasing", "expenses", editId);
  const mutations = useResourceMutations("purchasing", "expenses");
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
  const paymentAccounts = useMemo(
    () => references.accountOptionsFor("paymentAccountId"),
    [references],
  );
  const expenseAccounts = useMemo(
    () => references.accountOptionsFor("accountId"),
    [references],
  );

  const [payee, setPayee] = useState("");
  const [payeeVendorId, setPayeeVendorId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("close");

  useEffect(() => {
    if (!paymentAccountId && paymentAccounts[0])
      setPaymentAccountId(paymentAccounts[0].value);
  }, [paymentAccounts, paymentAccountId]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setPayee(String(data.payee ?? ""));
    setPaymentDate(String(data.paymentDate ?? todayIso()));
    setPaymentMethod(String(data.paymentMethod ?? "Cash"));
    setReference(String(data.reference ?? ""));
    setPaymentAccountId(
      String(data.paymentAccountId ?? data.paymentAccount ?? ""),
    );
    setAccountId(String(data.accountId ?? data.expenseAccount ?? ""));
    setAmount(String(data.amount ?? ""));
    setMemo(String(data.memo ?? ""));
  }, [detail.data, editId]);

  const resetForm = () => {
    setPayee("");
    setPayeeVendorId("");
    setPaymentDate(todayIso());
    setPaymentMethod("Cash");
    setReference("");
    setPaymentAccountId(paymentAccounts[0]?.value ?? "");
    setAccountId("");
    setAmount("");
    setMemo("");
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
    if (editId) router.push("/purchasing/expenses/new");
  };

  const save = async (mode: SaveMode) => {
    const selectedVendor = vendorOptions.find(
      (option) => typeof option !== "string" && option.value === payeeVendorId,
    );
    const payeeName =
      payee.trim() ||
      (selectedVendor && typeof selectedVendor !== "string"
        ? selectedVendor.label
        : "");
    if (!payeeName) {
      setMessage({
        title: "Payee required",
        description: "Enter or select who was paid.",
        variant: "error",
      });
      return;
    }
    if (!paymentAccountId || !accountId || !amount || Number(amount) <= 0) {
      setMessage({
        title: "Missing fields",
        description: "Payment account, expense account, and amount are required.",
        variant: "error",
      });
      return;
    }

    const data = {
      payee: payeeName,
      paymentDate,
      accountId,
      paymentAccountId,
      amount,
      currency: references.baseCurrency || "USD",
      paymentMethod,
      reference: reference || undefined,
      memo: memo || undefined,
    };

    setSaving(true);
    setSaveMode(mode);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined)
          throw new Error("Expense version is missing. Reload and try again.");
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: "incomplete",
          idempotencyKey: idempotencyKey.current,
        });
      }
      setMessage({
        title: "Expense saved",
        description:
          mode === "new"
            ? "Saved. Ready for another expense."
            : "Returning to expenses.",
        variant: "success",
      });
      if (mode === "close") {
        window.setTimeout(() => router.push("/purchasing/expenses"), 500);
      } else resetForm();
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this expense.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <form
        className="mx-auto max-w-[900px]"
        onSubmit={(event) => {
          event.preventDefault();
          void save("new");
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/purchasing/expenses"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to expenses
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit expense" : "Write check / expense"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#007DCC] bg-white px-4 text-xs font-bold text-[#007DCC]"
            >
              {saving && saveMode === "new" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
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
          <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] lg:col-span-2">
              Payee
              <Select
                value={payeeVendorId || undefined}
                onValueChange={(value) => {
                  setPayeeVendorId(value);
                  const option = vendorOptions.find(
                    (entry) =>
                      typeof entry !== "string" && entry.value === value,
                  );
                  if (option && typeof option !== "string")
                    setPayee(option.label);
                }}
                options={vendorOptions}
                placeholder="Select vendor or type below"
                allowAddNew
                addNewLabel="vendor"
                quickAddKind="vendor"
                onCreateOption={references.createOption}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
              <input
                value={payee}
                onChange={(event) => {
                  setPayee(event.target.value);
                  setPayeeVendorId("");
                }}
                placeholder="Or type payee name"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
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
              Bank / payment account
              <Select
                value={paymentAccountId || undefined}
                onValueChange={setPaymentAccountId}
                options={paymentAccounts}
                placeholder="Select account"
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
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
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] lg:col-span-2">
              Expense account
              <Select
                value={accountId || undefined}
                onValueChange={setAccountId}
                options={expenseAccounts}
                placeholder="Select expense account"
                allowAddNew
                addNewLabel="account"
                quickAddKind="account"
                onCreateOption={references.createOption}
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
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
          </div>
          <div className="px-4 py-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Memo
              <input
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
