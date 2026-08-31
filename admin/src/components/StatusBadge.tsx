import React from "react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const normalized = (status || "").toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case "ACTIVE":
      case "VERIFIED":
      case "COMPLETED":
      case "ACCEPTED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PENDING":
      case "IN_PROGRESS":
      case "TRIAL":
      case "BETA":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "SUSPENDED":
      case "EXPIRED":
      case "REVOKED":
      case "DELETED":
      case "UNVERIFIED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "COMING_SOON":
      case "INACTIVE":
      case "NOT_STARTED":
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${getStyle()} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {normalized}
    </span>
  );
};

export default StatusBadge;
