import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function LoadingState({
  label = "Loading",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  if (compact)
    return <span className={cn("inline-flex items-center gap-2 text-xs text-[#607681]", className)}><LoaderCircle size={14} className="animate-spin text-[#007DCC]"/>{label}</span>;

  return (
    <div className={cn("space-y-3 rounded-xl border border-[#e3eaf0] bg-white p-5", className)} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-[#344d59]">
        <LoaderCircle size={17} className="animate-spin text-[#007DCC]"/>
        {label}
      </div>
      <div className="h-2 w-full animate-pulse rounded-full bg-[#edf2f5]"/>
      <div className="h-2 w-4/5 animate-pulse rounded-full bg-[#edf2f5]"/>
      <span className="sr-only">{label}</span>
    </div>
  );
}
