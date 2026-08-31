import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}) => {
  const fromIndex = (currentPage - 1) * pageSize + 1;
  const toIndex = Math.min(currentPage * pageSize, totalCount);

  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
      <div>
        Showing <span className="font-semibold text-white">{fromIndex}</span> to{" "}
        <span className="font-semibold text-white">{toIndex}</span> of{" "}
        <span className="font-semibold text-white">{totalCount}</span> results
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1 text-xs font-semibold text-slate-200">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
