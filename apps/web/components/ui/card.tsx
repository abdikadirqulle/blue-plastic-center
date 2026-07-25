import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#dfe7ed] bg-white shadow-[0_1px_2px_rgba(7,31,51,0.035)]",
        className,
      )}
      {...props}
    />
  );
}
