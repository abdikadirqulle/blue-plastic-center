import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import {
  useDirtyFlag,
  type DedicatedFormProps,
} from "../../../components/ui/form-dialog";
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
 * QuickBooks Desktop-style New Vendor: identity, contact, payment settings.
 */
export function VendorFormPage({
  variant = "page",
  editId: editIdProp,
  onRequestClose,
  onSaved,
  onDirtyChange,
}: DedicatedFormProps = {}) {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = editIdProp ?? searchParams.get("edit") ?? "";
  const isDialog = variant === "dialog";
  const { markDirty, clearDirty } = useDirtyFlag(onDirtyChange);
  const detail = useResourceDetail("purchasing", "vendors", editId);
  const mutations = useResourceMutations("purchasing", "vendors");
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const payableOptions = useMemo(
    () => references.accountOptionsFor("payableAccountId"),
    [references],
  );

  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [creditLimit, setCreditLimit] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [asOf, setAsOf] = useState(todayIso());
  const [payableAccountId, setPayableAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("close");

  useEffect(() => {
    if (!payableAccountId && payableOptions[0])
      setPayableAccountId(payableOptions[0].value);
  }, [payableOptions, payableAccountId]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setDisplayName(String(data.displayName ?? data.vendorName ?? data.name ?? ""));
    setCompanyName(String(data.companyName ?? ""));
    setEmail(String(data.email ?? ""));
    setPhone(String(data.phone ?? ""));
    setAccountNumber(String(data.accountNumber ?? ""));
    setBillingAddress(String(data.billingAddress ?? data.address ?? ""));
    setTerms(String(data.terms ?? "Net 30"));
    setCreditLimit(String(data.creditLimit ?? ""));
    setOpeningBalance(String(data.openingBalance ?? "0"));
    setAsOf(String(data.asOf ?? todayIso()));
    setPayableAccountId(String(data.payableAccountId ?? ""));
    setNotes(String(data.notes ?? data.memo ?? ""));
  }, [detail.data, editId]);

  const resetForm = () => {
    clearDirty();
    setDisplayName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setAccountNumber("");
    setBillingAddress("");
    setTerms("Net 30");
    setCreditLimit("");
    setOpeningBalance("0");
    setAsOf(todayIso());
    setPayableAccountId(payableOptions[0]?.value ?? "");
    setNotes("");
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
    if (editId && !isDialog) router.push("/purchasing/vendors/new");
  };

  const save = async (mode: SaveMode) => {
    if (displayName.trim().length < 2) {
      setMessage({
        title: "Vendor name required",
        description: "Enter the vendor display name.",
        variant: "error",
      });
      return;
    }

    const data = {
      displayName: displayName.trim(),
      companyName: companyName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      accountNumber: accountNumber || undefined,
      billingAddress: billingAddress || undefined,
      terms: terms || undefined,
      creditLimit: creditLimit || undefined,
      openingBalance: openingBalance || "0",
      asOf: asOf || undefined,
      currency: references.baseCurrency || "USD",
      payableAccountId: payableAccountId || undefined,
      notes: notes || undefined,
    };

    setSaving(true);
    setSaveMode(mode);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined)
          throw new Error("Vendor version is missing. Reload and try again.");
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: "active",
          idempotencyKey: idempotencyKey.current,
        });
      }
      setMessage({
        title: "Vendor saved",
        description:
          mode === "new"
            ? "Saved. Ready for another vendor."
            : "Returning to vendors.",
        variant: "success",
      });
      clearDirty();
      onSaved?.();
      if (mode === "close") {
        if (isDialog) {
          onRequestClose?.();
        } else {
          window.setTimeout(() => router.push("/purchasing/vendors"), 500);
        }
      } else {
        resetForm();
        clearDirty();
      }
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this vendor.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form
      className={isDialog ? "w-full max-w-[900px]" : "mx-auto max-w-[900px]"}
      onSubmit={(event) => {
        event.preventDefault();
        void save("new");
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        {!isDialog ? (
          <div>
            <Link
              href="/purchasing/vendors"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to vendors
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit vendor" : "New vendor"}
            </h1>
          </div>
        ) : (
          <div />
        )}
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
          Vendor
        </div>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
            Vendor name
            <input
              value={displayName}
              onChange={(event) => {
                markDirty();
                setDisplayName(event.target.value);
              }}
              required
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Company name
            <input
              value={companyName}
              onChange={(event) => {
                markDirty();
                setCompanyName(event.target.value);
              }}
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Account no.
            <input
              value={accountNumber}
              onChange={(event) => {
                markDirty();
                setAccountNumber(event.target.value);
              }}
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Phone
            <input
              value={phone}
              onChange={(event) => {
                markDirty();
                setPhone(event.target.value);
              }}
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                markDirty();
                setEmail(event.target.value);
              }}
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Terms
            <Select
              value={terms}
              onValueChange={(value) => {
                markDirty();
                setTerms(value);
              }}
              options={["Due on receipt", "Net 15", "Net 30", "Net 60"]}
              searchable={false}
              className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
            Address
            <textarea
              value={billingAddress}
              onChange={(event) => {
                markDirty();
                setBillingAddress(event.target.value);
              }}
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
              onChange={(event) => {
                markDirty();
                setOpeningBalance(moneyInput(event.target.value));
              }}
              inputMode="decimal"
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            As of
            <div className="mt-1.5">
              <DatePicker
                value={asOf}
                onChange={(value) => {
                  markDirty();
                  setAsOf(value);
                }}
                className="h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </div>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Credit limit
            <input
              value={creditLimit}
              onChange={(event) => {
                markDirty();
                setCreditLimit(moneyInput(event.target.value));
              }}
              inputMode="decimal"
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2 lg:col-span-3">
            Accounts payable
            <Select
              value={payableAccountId || undefined}
              onValueChange={(value) => {
                markDirty();
                setPayableAccountId(value);
              }}
              options={payableOptions}
              placeholder="Select A/P account"
              className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2 lg:col-span-3">
            Notes
            <textarea
              value={notes}
              onChange={(event) => {
                markDirty();
                setNotes(event.target.value);
              }}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-[#c9d6df] bg-white px-3 py-2 text-xs outline-none"
            />
          </label>
        </div>
      </Card>
    </form>
  );

  if (isDialog) return form;
  return <AppShell>{form}</AppShell>;
}
