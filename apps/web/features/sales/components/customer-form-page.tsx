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

/**
 * QuickBooks Desktop-style New Customer: identity, contact, payment settings.
 */
export function CustomerFormPage() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail("sales", "customers", editId);
  const mutations = useResourceMutations("sales", "customers");
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const receivableOptions = useMemo(
    () => references.accountOptionsFor("receivableAccountId"),
    [references],
  );

  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [creditLimit, setCreditLimit] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [asOf, setAsOf] = useState(todayIso());
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("close");

  useEffect(() => {
    if (!receivableAccountId && receivableOptions[0])
      setReceivableAccountId(receivableOptions[0].value);
  }, [receivableOptions, receivableAccountId]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setDisplayName(String(data.displayName ?? data.customerName ?? data.name ?? ""));
    setCompanyName(String(data.companyName ?? ""));
    setEmail(String(data.email ?? ""));
    setPhone(String(data.phone ?? ""));
    setBillingAddress(String(data.billingAddress ?? data.address ?? ""));
    setTerms(String(data.terms ?? "Net 30"));
    setCreditLimit(String(data.creditLimit ?? ""));
    setOpeningBalance(String(data.openingBalance ?? "0"));
    setAsOf(String(data.asOf ?? todayIso()));
    setReceivableAccountId(String(data.receivableAccountId ?? ""));
    setNotes(String(data.notes ?? data.memo ?? ""));
  }, [detail.data, editId]);

  const resetForm = () => {
    setDisplayName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setBillingAddress("");
    setTerms("Net 30");
    setCreditLimit("");
    setOpeningBalance("0");
    setAsOf(todayIso());
    setReceivableAccountId(receivableOptions[0]?.value ?? "");
    setNotes("");
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
    if (editId) router.push("/sales/customers/new");
  };

  const save = async (mode: SaveMode) => {
    if (displayName.trim().length < 2) {
      setMessage({
        title: "Customer name required",
        description: "Enter the customer display name.",
        variant: "error",
      });
      return;
    }

    const data = {
      displayName: displayName.trim(),
      companyName: companyName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      billingAddress: billingAddress || undefined,
      terms: terms || undefined,
      creditLimit: creditLimit || undefined,
      openingBalance: openingBalance || "0",
      asOf: asOf || undefined,
      currency: references.baseCurrency || "USD",
      receivableAccountId: receivableAccountId || undefined,
      notes: notes || undefined,
    };

    setSaving(true);
    setSaveMode(mode);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined)
          throw new Error("Customer version is missing. Reload and try again.");
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: "active",
          idempotencyKey: idempotencyKey.current,
        });
      }
      setMessage({
        title: "Customer saved",
        description:
          mode === "new"
            ? "Saved. Ready for another customer."
            : "Returning to customers.",
        variant: "success",
      });
      if (mode === "close") {
        window.setTimeout(() => router.push("/sales/customers"), 500);
      } else resetForm();
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this customer.",
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
              href="/sales/customers"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to customers
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit customer" : "New customer"}
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
          <div className="border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Customer
          </div>
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
              Customer name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Company name
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Phone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
              Billing address
              <textarea
                value={billingAddress}
                onChange={(event) => setBillingAddress(event.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-[#c9d6df] bg-white px-3 py-2 text-xs outline-none"
              />
            </label>
          </div>

          <div className="border-t border-[#e5ecf1] bg-[#f7fafc] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Payment & credit
          </div>
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Opening balance
              <input
                value={openingBalance}
                onChange={(event) =>
                  setOpeningBalance(moneyInput(event.target.value))
                }
                inputMode="decimal"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              As of
              <div className="mt-1.5">
                <DatePicker
                  value={asOf}
                  onChange={setAsOf}
                  className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </div>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Credit limit
              <input
                value={creditLimit}
                onChange={(event) =>
                  setCreditLimit(moneyInput(event.target.value))
                }
                inputMode="decimal"
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2 lg:col-span-3">
              Accounts receivable
              <Select
                value={receivableAccountId || undefined}
                onValueChange={setReceivableAccountId}
                options={receivableOptions}
                placeholder="Select A/R account"
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2 lg:col-span-3">
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-[#c9d6df] bg-white px-3 py-2 text-xs outline-none"
              />
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
