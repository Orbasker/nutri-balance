"use client";

interface SearchPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function SearchPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: SearchPaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  // Build page numbers to show: current +/- 2, plus first and last
  const pages: (number | "ellipsis")[] = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) {
      pages.push(p);
    }
  };

  addPage(1);
  if (page - 2 > 2) pages.push("ellipsis");
  for (let i = page - 2; i <= page + 2; i++) addPage(i);
  if (page + 2 < totalPages - 1) pages.push("ellipsis");
  addPage(totalPages);

  return (
    <div className="flex flex-col items-center gap-4 pt-4">
      {/* Page info */}
      <p className="text-xs text-md-outline font-medium">
        Showing {start}–{end} of {totalCount} results
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-md-on-surface-variant hover:bg-md-surface-container-high disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="w-9 h-9 flex items-center justify-center text-md-outline text-sm"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                p === page
                  ? "bg-md-primary text-white"
                  : "text-md-on-surface-variant hover:bg-md-surface-container-high"
              }`}
            >
              {p}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-md-on-surface-variant hover:bg-md-surface-container-high disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label="Next page"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
