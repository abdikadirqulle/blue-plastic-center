"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";

/** Tracks user edits so modal close can ask before discarding. */
export function useDirtyFlag(onDirtyChange?: (dirty: boolean) => void) {
  const dirtyRef = useRef(false);
  const markDirty = () => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    onDirtyChange?.(true);
  };
  const clearDirty = () => {
    dirtyRef.current = false;
    onDirtyChange?.(false);
  };
  return { markDirty, clearDirty };
}

/**
 * Confirm before discarding unsaved form input (outside click, Escape, or Cancel).
 */
export function ConfirmDiscardDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onKeepEditing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onKeepEditing]);

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={onKeepEditing}
      className="fixed inset-0 z-[240] grid place-items-center bg-[#071f33]/55 p-4 backdrop-blur-sm"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-[0_28px_90px_rgba(7,31,51,0.32)]"
      >
        <div className="px-6 pb-5 pt-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-8 ring-amber-50/80">
            <AlertTriangle size={22} />
          </span>
          <h2
            id="discard-dialog-title"
            className="mt-5 text-xl font-bold tracking-[-0.03em] text-[#213946]"
          >
            Discard changes?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d808b]">
            You have unsaved changes. If you leave now, those changes will be
            lost.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#edf1f4] bg-[#fbfcfd] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onKeepEditing}
            className="h-11 rounded-xl border border-[#dce6ed] bg-white px-5 text-xs font-bold text-[#526874] hover:bg-[#f4f7f9]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="h-11 rounded-xl bg-amber-600 px-5 text-xs font-bold text-white hover:bg-amber-700"
          >
            Discard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Modal shell for QuickBooks-style create forms. Outside click / Escape asks
 * for discard confirmation when the form is dirty.
 */
export function FormDialog({
  open,
  title,
  dirty,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  dirty: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const requestClose = () => {
    if (dirtyRef.current) setDiscardOpen(true);
    else onClose();
  };

  useEffect(() => {
    if (!open) {
      setDiscardOpen(false);
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !discardOpen) {
        if (dirtyRef.current) setDiscardOpen(true);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, discardOpen, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        onMouseDown={(event) => {
          // Only the dimmed backdrop closes the form — not portaled selects/date pickers.
          if (event.target !== event.currentTarget) return;
          if (
            document.querySelector(
              '[data-radix-popper-content-wrapper], [data-radix-select-content]',
            )
          )
            return;
          requestClose();
        }}
        className="fixed inset-0 z-[200] grid place-items-start justify-center overflow-y-auto bg-[#071f33]/45 p-4 py-8 backdrop-blur-sm sm:py-12"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onMouseDown={(event) => event.stopPropagation()}
          className={`w-full overflow-hidden rounded-2xl border border-[#d5e0e7] bg-[#f4f7fa] shadow-[0_28px_90px_rgba(7,31,51,0.28)] ${
            wide ? "max-w-[960px]" : "max-w-[760px]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#e5ecf1] bg-white px-4 py-3">
            <h2 className="text-lg font-bold tracking-[-0.03em] text-[#142735]">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={requestClose}
              className="rounded-xl p-2 text-[#81919a] hover:bg-[#f1f5f7] hover:text-[#405762]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="max-h-[min(80vh,820px)] overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
      <ConfirmDiscardDialog
        open={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </>,
    document.body,
  );
}

export interface DedicatedFormProps {
  variant?: "page" | "dialog";
  editId?: string;
  onRequestClose?: () => void;
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}
