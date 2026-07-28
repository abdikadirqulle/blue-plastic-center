"use client";

import { Link } from "@/components/routing";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RowActionMenu({
  label,
  viewHref,
  editHref,
  onDelete,
}: {
  label: string;
  viewHref: string;
  editHref: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const bounds = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: bounds.bottom + 6,
        left: Math.max(12, bounds.right - 176),
      });
    }
    setOpen((current) => !current);
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target))
        setOpen(false);
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={`Actions for ${label}`} aria-expanded={open} onClick={toggle} className="rounded-lg p-2 text-[#758995] hover:bg-[#eef7fd] hover:text-[#007DCC]">
        <MoreHorizontal size={16}/>
      </button>
      {open ? createPortal(
        <div ref={menuRef} role="menu" style={{ top: position.top, left: position.left }} className="fixed z-[190] w-44 rounded-xl border border-[#dce6ed] bg-white p-1.5 text-left shadow-[0_16px_45px_rgba(20,45,60,0.2)]">
          <Link role="menuitem" href={viewHref} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[#eef7fd]"><Eye size={14}/> View details</Link>
          <Link role="menuitem" href={editHref} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[#eef7fd]"><Pencil size={14}/> Edit</Link>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={14}/> Delete</button>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
