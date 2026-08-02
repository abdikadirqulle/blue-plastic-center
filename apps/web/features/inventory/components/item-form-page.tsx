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

type ItemType = "inventory" | "non-inventory" | "service" | "assembly";
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

const ITEM_TYPES: Array<{ label: string; value: ItemType }> = [
  { label: "Inventory part", value: "inventory" },
  { label: "Non-inventory part", value: "non-inventory" },
  { label: "Service", value: "service" },
  { label: "Assembly", value: "assembly" },
];

const UNITS = ["Each", "Box", "Kg", "Liter", "Meter", "Hour", "Case", "Dozen"];

/**
 * QuickBooks Desktop-style New Item: type at the top, then sales / purchase /
 * inventory sections that appear based on type.
 */
export function ItemFormPage({
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
  const detail = useResourceDetail("inventory", "items", editId);
  const mutations = useResourceMutations("inventory", "items");
  const references = useReferenceData();
  const idempotencyKey = useRef(crypto.randomUUID());
  const loadedKey = useRef("");

  const incomeOptions = useMemo(
    () => references.accountOptionsFor("incomeAccountId"),
    [references],
  );
  const cogsOptions = useMemo(
    () => references.accountOptionsFor("expenseAccountId"),
    [references],
  );
  const inventoryOptions = useMemo(
    () => references.accountOptionsFor("inventoryAccountId"),
    [references],
  );
  const vendorOptions = useMemo(
    () =>
      references.optionsFor({
        name: "preferredVendorId",
        label: "Vendor",
        type: "select",
      }) ?? [],
    [references],
  );

  const [type, setType] = useState<ItemType>("inventory");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("Each");
  const [category, setCategory] = useState("");
  const [salesDescription, setSalesDescription] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [purchaseDescription, setPurchaseDescription] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [preferredVendorId, setPreferredVendorId] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [openingQuantity, setOpeningQuantity] = useState("");
  const [asOf, setAsOf] = useState(todayIso());
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("close");

  const isInventory = type === "inventory" || type === "assembly";
  const isPurchased = type !== "service";

  useEffect(() => {
    if (!incomeAccountId && incomeOptions[0])
      setIncomeAccountId(incomeOptions[0].value);
  }, [incomeOptions, incomeAccountId]);

  useEffect(() => {
    if (isPurchased && !expenseAccountId && cogsOptions[0])
      setExpenseAccountId(cogsOptions[0].value);
  }, [cogsOptions, expenseAccountId, isPurchased]);

  useEffect(() => {
    if (isInventory && !inventoryAccountId && inventoryOptions[0])
      setInventoryAccountId(inventoryOptions[0].value);
  }, [inventoryOptions, inventoryAccountId, isInventory]);

  useEffect(() => {
    const record = detail.data?.data;
    const key = `${editId}|${record?.id ?? ""}`;
    if (!record || loadedKey.current === key) return;
    loadedKey.current = key;
    const data = record.data;
    setType((String(data.type ?? "inventory") as ItemType) || "inventory");
    setName(String(data.name ?? ""));
    setUnit(String(data.unit ?? "Each"));
    setCategory(String(data.category ?? ""));
    setSalesDescription(
      String(data.salesDescription ?? data.description ?? ""),
    );
    setSalesPrice(String(data.salesPrice ?? ""));
    setIncomeAccountId(String(data.incomeAccountId ?? ""));
    setPurchaseDescription(String(data.purchaseDescription ?? ""));
    setPurchaseCost(String(data.purchaseCost ?? ""));
    setExpenseAccountId(String(data.expenseAccountId ?? ""));
    setInventoryAccountId(String(data.inventoryAccountId ?? ""));
    setPreferredVendorId(String(data.preferredVendorId ?? ""));
    setReorderPoint(String(data.reorderPoint ?? ""));
    setOpeningQuantity(String(data.openingQuantity ?? ""));
    setAsOf(String(data.asOf ?? todayIso()));
  }, [detail.data, editId]);

  const resetForm = () => {
    clearDirty();
    setType("inventory");
    setName("");
    setUnit("Each");
    setCategory("");
    setSalesDescription("");
    setSalesPrice("");
    setIncomeAccountId(incomeOptions[0]?.value ?? "");
    setPurchaseDescription("");
    setPurchaseCost("");
    setExpenseAccountId(cogsOptions[0]?.value ?? "");
    setInventoryAccountId(inventoryOptions[0]?.value ?? "");
    setPreferredVendorId("");
    setReorderPoint("");
    setOpeningQuantity("");
    setAsOf(todayIso());
    idempotencyKey.current = crypto.randomUUID();
    loadedKey.current = "";
    if (editId && !isDialog) router.push("/inventory/items/new");
  };

  const save = async (mode: SaveMode) => {
    if (!name.trim()) {
      setMessage({
        title: "Item name required",
        description: "Enter the item name/number.",
        variant: "error",
      });
      return;
    }

    const data = {
      type,
      name: name.trim(),
      // API still requires sku; derive quietly from the item name.
      sku: name.trim().slice(0, 40),
      unit: unit || "Each",
      category: category || undefined,
      salesDescription: salesDescription || undefined,
      salesPrice: salesPrice || "0",
      incomeAccountId: incomeAccountId || undefined,
      purchaseDescription: isPurchased
        ? purchaseDescription || undefined
        : undefined,
      purchaseCost: isPurchased ? purchaseCost || "0" : "0",
      expenseAccountId: isPurchased ? expenseAccountId || undefined : undefined,
      inventoryAccountId: isInventory
        ? inventoryAccountId || undefined
        : undefined,
      preferredVendorId: isPurchased
        ? preferredVendorId || undefined
        : undefined,
      reorderPoint: isInventory ? reorderPoint || undefined : undefined,
      openingQuantity: isInventory ? openingQuantity || undefined : undefined,
      asOf: isInventory ? asOf || undefined : undefined,
    };

    setSaving(true);
    setSaveMode(mode);
    try {
      if (editId) {
        const version = detail.data?.data.version;
        if (version === undefined) {
          throw new Error("Item version is missing. Reload and try again.");
        }
        await mutations.update.mutateAsync({ id: editId, data, version });
      } else {
        await mutations.create.mutateAsync({
          data,
          status: "active",
          idempotencyKey: idempotencyKey.current,
        });
      }
      setMessage({
        title: "Item saved",
        description:
          mode === "new"
            ? "Saved. Ready for another item."
            : "Returning to items.",
        variant: "success",
      });
      clearDirty();
      onSaved?.();
      if (mode === "close") {
        if (isDialog) {
          onRequestClose?.();
        } else {
          window.setTimeout(() => router.push("/inventory/items"), 500);
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
            : "The API rejected this item.",
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
              href="/inventory/items"
              className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={14} /> Back to items
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#142735]">
              {editId ? "Edit item" : "New item"}
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
        <div className="grid gap-3 border-b border-[#e5ecf1] bg-[#f7fafc] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Type
            <Select
              value={type}
              onValueChange={(value) => {
                markDirty();
                setType(value as ItemType);
              }}
              options={ITEM_TYPES}
              searchable={false}
              className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
            Item name/number
            <input
              value={name}
              onChange={(event) => {
                markDirty();
                setName(event.target.value);
              }}
              required
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Unit of measure
            <Select
              value={unit}
              onValueChange={(value) => {
                markDirty();
                setUnit(value);
              }}
              options={UNITS}
              searchable={false}
              className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Category
            <input
              value={category}
              onChange={(event) => {
                markDirty();
                setCategory(event.target.value);
              }}
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-xs outline-none"
            />
          </label>
        </div>

        <div className="border-b border-[#e5ecf1] bg-[#eef4f8] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
          Sales information
        </div>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Sales price
            <input
              value={salesPrice}
              onChange={(event) => {
                markDirty();
                setSalesPrice(moneyInput(event.target.value));
              }}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
            Income account
            <Select
              value={incomeAccountId || undefined}
              onValueChange={(value) => {
                markDirty();
                setIncomeAccountId(value);
              }}
              options={incomeOptions}
              placeholder="Select account"
              allowAddNew
              addNewLabel="account"
              quickAddKind="account"
              onCreateOption={references.createOption}
              className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
            Description on sales forms
            <textarea
              value={salesDescription}
              onChange={(event) => {
                markDirty();
                setSalesDescription(event.target.value);
              }}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-[#c9d6df] bg-white px-3 py-2 text-xs outline-none"
            />
          </label>
        </div>

        {isPurchased ? (
          <>
            <div className="border-y border-[#e5ecf1] bg-[#eef4f8] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
              Purchase information
            </div>
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                Cost
                <input
                  value={purchaseCost}
                  onChange={(event) => {
                    markDirty();
                    setPurchaseCost(moneyInput(event.target.value));
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                {isInventory ? "COGS account" : "Expense account"}
                <Select
                  value={expenseAccountId || undefined}
                  onValueChange={(value) => {
                    markDirty();
                    setExpenseAccountId(value);
                  }}
                  options={cogsOptions}
                  placeholder="Select account"
                  allowAddNew
                  addNewLabel="account"
                  quickAddKind="account"
                  onCreateOption={references.createOption}
                  className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
                Preferred vendor
                <Select
                  value={preferredVendorId || undefined}
                  onValueChange={(value) => {
                    markDirty();
                    setPreferredVendorId(value);
                  }}
                  options={vendorOptions}
                  placeholder="Optional"
                  allowAddNew
                  addNewLabel="vendor"
                  quickAddKind="vendor"
                  onCreateOption={references.createOption}
                  className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
                Description on purchase forms
                <textarea
                  value={purchaseDescription}
                  onChange={(event) => {
                    markDirty();
                    setPurchaseDescription(event.target.value);
                  }}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-[#c9d6df] bg-white px-3 py-2 text-xs outline-none"
                />
              </label>
            </div>
          </>
        ) : null}

        {isInventory ? (
          <>
            <div className="border-y border-[#e5ecf1] bg-[#eef4f8] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#6f8390]">
              Inventory information
            </div>
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97] sm:col-span-2">
                Asset account
                <Select
                  value={inventoryAccountId || undefined}
                  onValueChange={(value) => {
                    markDirty();
                    setInventoryAccountId(value);
                  }}
                  options={inventoryOptions}
                  placeholder="Select account"
                  allowAddNew
                  addNewLabel="account"
                  quickAddKind="account"
                  onCreateOption={references.createOption}
                  className="mt-1.5 h-9 rounded-lg border-[#c9d6df] bg-white text-xs"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                Reorder point
                <input
                  value={reorderPoint}
                  onChange={(event) => {
                    markDirty();
                    setReorderPoint(moneyInput(event.target.value));
                  }}
                  inputMode="decimal"
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#c9d6df] bg-white px-3 text-right text-xs tabular-nums outline-none"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7a8d97]">
                On hand
                <input
                  value={openingQuantity}
                  onChange={(event) => {
                    markDirty();
                    setOpeningQuantity(moneyInput(event.target.value));
                  }}
                  inputMode="decimal"
                  placeholder="0"
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
            </div>
          </>
        ) : null}
      </Card>
    </form>
  );

  if (isDialog) return form;
  return <AppShell>{form}</AppShell>;
}
