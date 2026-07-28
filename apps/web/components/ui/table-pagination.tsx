import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "./select";

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5ecf1] px-5 py-3">
      <p className="text-[11px] text-[#71848f]">
        Showing{" "}
        <strong className="text-[#405762]">
          {first}–{last}
        </strong>{" "}
        of <strong className="text-[#405762]">{total}</strong>
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] text-[#71848f]">
          Rows per page
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            searchable={false}
            options={["10", "20", "50", "100", "200"]}
            className="h-8 w-20 rounded-lg text-xs"
          />
        </label>
        <span className="text-[11px] text-[#71848f]">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <div className="flex gap-1">
          <button
            disabled={page <= 1}
            aria-label="Previous page"
            onClick={() => onPageChange(page - 1)}
            className="grid size-8 place-items-center rounded-lg border border-[#dce6ed] bg-white disabled:opacity-40"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            disabled={page >= totalPages}
            aria-label="Next page"
            onClick={() => onPageChange(page + 1)}
            className="grid size-8 place-items-center rounded-lg border border-[#dce6ed] bg-white disabled:opacity-40"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
