"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";
export interface ToastMessage {
  title: string;
  description?: string;
  variant: ToastVariant;
}

const variants = {
  success: {
    icon: CheckCircle2,
    frame: "border-emerald-200 bg-white",
    iconWrap: "bg-emerald-100 text-emerald-600",
    title: "text-emerald-800",
    bar: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    frame: "border-red-200 bg-white",
    iconWrap: "bg-red-100 text-red-600",
    title: "text-red-800",
    bar: "bg-red-500",
  },
  warning: {
    icon: TriangleAlert,
    frame: "border-amber-200 bg-white",
    iconWrap: "bg-amber-100 text-amber-600",
    title: "text-amber-800",
    bar: "bg-amber-500",
  },
  info: {
    icon: Info,
    frame: "border-sky-200 bg-white",
    iconWrap: "bg-sky-100 text-[#007DCC]",
    title: "text-[#0069ad]",
    bar: "bg-[#007DCC]",
  },
};

export function Toast({
  message,
  onClose,
}: {
  message: ToastMessage | null;
  onClose: () => void;
}) {
  if (!message) return null;
  const style = variants[message.variant];
  const Icon = style.icon;

  return (
    <div role={message.variant === "error" ? "alert" : "status"} aria-live="polite" className={cn("fixed right-4 top-[72px] z-[120] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-[0_14px_40px_rgba(15,42,58,0.18)] lg:right-6", style.frame)}>
      <div className="flex items-start gap-3 p-4">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", style.iconWrap)}><Icon size={20}/></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn("text-sm font-bold", style.title)}>{message.title}</p>
          {message.description ? <p className="mt-1 text-xs leading-5 text-[#647984]">{message.description}</p> : null}
        </div>
        <button type="button" aria-label="Close notification" onClick={onClose} className="rounded-lg p-1.5 text-[#80919b] hover:bg-[#f1f5f7]"><X size={15}/></button>
      </div>
      <div className={cn("h-1 w-full animate-pulse", style.bar)}/>
    </div>
  );
}
