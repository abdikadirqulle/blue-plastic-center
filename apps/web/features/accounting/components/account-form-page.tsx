import { Link, useRouter } from "@/components/routing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { accountTypeOptions, type AccountDetailType } from "@blue-plastic/types";
import { AppShell } from "../../../components/layout/app-shell";
import { Card } from "../../../components/ui/card";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import { useReferenceData } from "../../resources/reference-data";
import {
  recordTitle,
  useResourceDetail,
  useResourceList,
  useResourceMutations,
} from "../../resources/resource-api";

type SaveMode = "new" | "close";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return cleaned === "-" ? "-" : "";
  if (!/^-?\d*(\.\d{0,4})?$/.test(cleaned)) return value;
  return cleaned;
}

const BALANCE_TYPES = new Set([
  "bank",
  "accounts-receivable",
  "other-current-asset",
  "fixed-asset",
  "other-asset",
  "accounts-payable",
  "credit-card",
  "other-current-liability",
  "long-term-liability",
  "equity",
  "asset",
  "liability",
]);

/**
 * QuickBooks Desktop-style New Account: type first, then number/name,
 * optional subaccount, opening balance, and description.
 */
export function AccountFormPage() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail("accounting", "chart-of-accounts", editId);
  const mutations = useResourceMutations("accounting", "chart-of-accounts");
  const accounts = useResourceList("accounting", "chart-of-accounts", {
    page: 1,
    pageSize: 200,
  });
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const parentOptions = useMemo(
    () =>
      (accounts.data?.data ?? [])
        .filter((record) => record.id !== editId)
        .map((record) => {
          const number = String(record.data.accountNumber ?? "");
          const name = recordTitle(record);
          return {
            value: record.id,
            label: number ? `${number} — ${name}` : name,
          };
        }),
    [accounts.data, editId],
  );

  const [accountType, setAccountType] = useState<AccountDetailType>("expense");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isSubaccount, setIsSubaccount] = useState(false);
  const [parentId, setParentId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOf, setAsOf] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [inactive, setInactive] = useState(false);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("close");

  const showOpeningBalance = BALANCE_TYPES.has(accountType);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setAccountType(
      (String(data.accountType ?? "expense") as AccountDetailType) || "expense",
    );
    setAccountNumber(String(data.accountNumber ?? ""));
    setAccountName(String(data.accountName ?? data.name ?? ""));
    const parent = String(data.parentId ?? data.subaccountOf ?? "");
    setIsSubaccount(Boolean(parent));
    setParentId(parent);
    setOpeningBalance(String(data.openingBalance ?? ""));
    setAsOf(String(data.asOf ?? todayIso()));
    setDescription(String(data.description ?? ""));
    setInactive(Boolean(data.inactive));
  }, [detail.data, editId]);

  const resetForm = () => {
    setAccountType("expense");
    setAccountNumber("");
    setAccountName("");
    setIsSubaccount(false);
    setParentId("");
    setOpeningBalance("");
    setAsOf(todayIso());
    setDescription("");
    setInactive(false);
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
    if (editId) router.push("/accounting/chart-of-accounts/new");
  };

  const save = async (mode: SaveMode) => {
    if (!accountNumber.trim()) {
      setMessage({
        title: "Account number required",
        description: "Enter an account number (for example 6000).",
        variant: "error",
      });
      return;
    }
    if (!accountName.trim()) {
      setMessage({
        title: "Account name required",
        description: "Enter the account name.",
        variant: "error",
      });
      return;
    }
    if (isSubaccount && !parentId) {
      setMessage({
        title: "Subaccount required",
        description: "Choose the parent account, or uncheck Subaccount of.",
        variant: "error",
      });
      return;
    }

    const data = {
      accountType,
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim(),
      parentId: isSubaccount && parentId ? parentId : undefined,
      currency: references.baseCurrency || "USD",
      openingBalance:
        showOpeningBalance && openingBalance ? openingBalance : undefined,
      asOf: showOpeningBalance && asOf ? asOf : undefined,
      description: description || undefined,
      inactive,
    };

    setSaving(true);
    setSaveMode(mode);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined) {
          throw new Error("Account version is missing. Reload and try again.");
        }
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: inactive ? "inactive" : "active",
          idempotencyKey: idempotencyKey.current,
        });
      }
      setMessage({
        title: "Account saved",
        description:
          mode === "new"
            ? "Saved. Ready for another account."
            : "Returning to chart of accounts.",
        variant: "success",
      });
      if (mode === "close") {
        window.setTimeout(
          () => router.push("/accounting/chart-of-accounts"),
          500,
        );
      } else resetForm();
    } catch (caught) {
      setMessage({
        title: "Could not save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this account.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <form
        className="mx-auto max-w-[720px]"
        onSubmit={(event) => {
          event.preventDefault();
          void save("new");
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/accounting/chart-of-accounts"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to chart of accounts
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit account" : "New account"}
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
          <div className="border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Account type
              <Select
                value={accountType}
                onValueChange={(value) =>
                  setAccountType(value as AccountDetailType)
                }
                options={[...accountTypeOptions]}
                searchable
                className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
              />
            </label>
          </div>

          <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Number
              <input
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="e.g. 6000"
                required
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
              Account name
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="e.g. Office expenses"
                required
                className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
              />
            </label>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#405762]">
                <input
                  type="checkbox"
                  checked={isSubaccount}
                  onChange={(event) => {
                    setIsSubaccount(event.target.checked);
                    if (!event.target.checked) setParentId("");
                  }}
                  className="size-4 accent-[#007DCC]"
                />
                Subaccount of
              </label>
              {isSubaccount ? (
                <Select
                  value={parentId || undefined}
                  onValueChange={setParentId}
                  options={parentOptions}
                  placeholder="Select parent account"
                  className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              ) : null}
            </div>

            {showOpeningBalance ? (
              <>
                <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                  Opening balance
                  <input
                    value={openingBalance}
                    onChange={(event) =>
                      setOpeningBalance(moneyInput(event.target.value))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
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
              </>
            ) : null}

            <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-[#c9d6df] bg-white px-3 py-2 text-xs outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#405762] sm:col-span-2">
              <input
                type="checkbox"
                checked={inactive}
                onChange={(event) => setInactive(event.target.checked)}
                className="size-4 accent-[#007DCC]"
              />
              Account is inactive
            </label>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
