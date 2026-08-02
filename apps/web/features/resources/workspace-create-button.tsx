"use client";

import { useState, type ComponentType } from "react";
import { Plus } from "lucide-react";
import {
  FormDialog,
  type DedicatedFormProps,
} from "../../components/ui/form-dialog";
import { AccountFormPage } from "../accounting/components/account-form-page";
import { ItemFormPage } from "../inventory/components/item-form-page";
import { ExpenseFormPage } from "../purchasing/components/expense-form-page";
import { VendorFormPage } from "../purchasing/components/vendor-form-page";
import { CustomerFormPage } from "../sales/components/customer-form-page";

const modalForms: Record<
  string,
  {
    title: string;
    wide?: boolean;
    Form: ComponentType<DedicatedFormProps>;
  }
> = {
  "sales/customers": { title: "New customer", Form: CustomerFormPage },
  "purchasing/vendors": { title: "New vendor", Form: VendorFormPage },
  "purchasing/expenses": {
    title: "Write check / expense",
    Form: ExpenseFormPage,
  },
  "inventory/items": { title: "New item", Form: ItemFormPage, wide: true },
  "accounting/chart-of-accounts": {
    title: "New account",
    Form: AccountFormPage,
  },
};

export function isModalCreateResource(module: string, slug: string) {
  return Boolean(modalForms[`${module}/${slug}`]);
}

/**
 * Primary-action button that opens a create form in a modal for the listed
 * resources, instead of navigating to /new.
 */
export function WorkspaceCreateButton({
  module,
  slug,
  label,
}: {
  module: string;
  slug: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const config = modalForms[`${module}/${slug}`];

  if (!config) {
    return (
      <a
        href={`/${module}/${slug}/new`}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
      >
        <Plus size={16} />
        {label}
      </a>
    );
  }

  const { Form, title, wide } = config;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDirty(false);
          setFormKey((current) => current + 1);
          setOpen(true);
        }}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
      >
        <Plus size={16} />
        {label}
      </button>
      <FormDialog
        open={open}
        title={title}
        dirty={dirty}
        wide={wide}
        onClose={() => {
          setOpen(false);
          setDirty(false);
        }}
      >
        <Form
          key={formKey}
          variant="dialog"
          onDirtyChange={setDirty}
          onSaved={() => setDirty(false)}
          onRequestClose={() => {
            setOpen(false);
            setDirty(false);
          }}
        />
      </FormDialog>
    </>
  );
}
