"use client";

import { useEffect } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";

export function ConfirmDeleteDialog({
  open,
  title = "Delete this record?",
  recordName,
  description = "This action removes the record from the current workspace. This cannot be undone.",
  confirmLabel = "Move to Trash",
  pendingLabel = "Deleting…",
  confirming = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  recordName?: string;
  description?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  confirming?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose, confirming]);

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={() => {
        if (!confirming) onClose();
      }}
      className="fixed inset-0 z-[250] grid place-items-center bg-[#071f33]/50 p-4 backdrop-blur-sm"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-red-100 bg-white shadow-[0_28px_90px_rgba(7,31,51,0.32)]"
      >
        <div className="relative bg-gradient-to-br from-red-50 via-white to-white px-6 pb-5 pt-6">
          <button
            type="button"
            aria-label="Close delete confirmation"
            disabled={confirming}
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl p-2 text-[#81919a] hover:bg-white hover:text-[#405762] disabled:opacity-50"
          >
            <X size={17} />
          </button>
          <span className="grid size-12 place-items-center rounded-2xl bg-red-100 text-red-600 ring-8 ring-red-50">
            <ShieldAlert size={23} />
          </span>
          <h2
            id="delete-dialog-title"
            className="mt-5 text-xl font-bold tracking-[-0.03em] text-[#213946]"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d808b]">{description}</p>
          {recordName ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-100 bg-white p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b9aa2]">
                  Selected record
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-[#304853]">
                  {recordName}
                </p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#edf1f4] bg-[#fbfcfd] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={confirming}
            onClick={onClose}
            className="h-11 rounded-xl border border-[#dce6ed] bg-white px-5 text-xs font-bold text-[#526874] hover:bg-[#f4f7f9] disabled:opacity-50"
          >
            Keep record
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={() => void onConfirm()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-bold text-white shadow-sm shadow-red-200 hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={15} />
            {confirming ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
