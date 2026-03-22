"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface QuickAction {
  icon: string;
  label: string;
  color: string;
  onClick: () => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: "upload_file",
    label: "Upload file",
    color: "bg-violet-500",
    onClick: () => {},
  },
  {
    icon: "database_upload",
    label: "Import food data",
    color: "bg-teal-500",
    onClick: () => {},
  },
  {
    icon: "nutrition",
    label: "Explore nutrients",
    color: "bg-amber-500",
    onClick: () => {},
  },
  {
    icon: "search",
    label: "Search food",
    color: "bg-blue-500",
    onClick: () => {},
  },
  {
    icon: "barcode_scanner",
    label: "Scan barcode",
    color: "bg-rose-500",
    onClick: () => {},
  },
  {
    icon: "photo_camera",
    label: "Photo meal",
    color: "bg-emerald-500",
    onClick: () => {},
  },
];

// Half-circle layout: actions fan out from bottom-center upward
function getArcPosition(index: number, total: number, radius: number) {
  // Distribute items along a half circle (π to 0, i.e. left to right, going up)
  const angle = Math.PI - (index / (total - 1)) * Math.PI;
  const x = Math.cos(angle) * radius;
  const y = -Math.sin(angle) * radius; // negative because CSS y goes down
  return { x, y };
}

export function QuickActionsMenu({ onAction }: { onAction?: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      {/* Floating action items */}
      <div
        className={cn(
          "absolute bottom-full left-1/2 pointer-events-none",
          open && "pointer-events-auto",
        )}
        style={{ width: 0, height: 0 }}
      >
        {QUICK_ACTIONS.map((action, i) => {
          const { x, y } = getArcPosition(i, QUICK_ACTIONS.length, 160);
          return (
            <div
              key={action.label}
              className={cn(
                "group absolute flex flex-col items-center gap-1.5 transition-all duration-300 ease-out",
                open ? "opacity-100 scale-100" : "opacity-0 scale-50",
              )}
              style={{
                transform: open
                  ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                  : "translate(-50%, 0)",
                transitionDelay: open ? `${i * 50}ms` : "0ms",
              }}
            >
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  action.onClick();
                  onAction?.(action.label);
                  setOpen(false);
                }}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg",
                  "hover:scale-110 active:scale-95 transition-transform",
                  action.color,
                )}
              >
                <span className="material-symbols-outlined text-2xl">{action.icon}</span>
              </button>
              {/* Tooltip — only visible on hover */}
              <span
                className={cn(
                  "absolute -bottom-8 left-1/2 -translate-x-1/2",
                  "text-xs font-medium text-slate-700 whitespace-nowrap",
                  "bg-white px-2.5 py-1 rounded-lg shadow-md border border-slate-100",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                  "pointer-events-none",
                )}
              >
                {action.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Trigger button */}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300",
          open
            ? "bg-slate-700 text-white rotate-45 shadow-lg"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
        )}
        title={open ? "Close quick actions" : "Quick actions"}
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  );
}
