import React from "react";
import { Shield, Clock } from "lucide-react";

interface ActivityItem {
  id?: string;
  _id?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  createdAt?: number;
  details?: Record<string, any>;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  emptyMessage?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  emptyMessage = "No recent activity recorded.",
}) => {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const id = item.id || item._id;
        const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : "";
        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "";

        return (
          <div
            key={id}
            className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-200 truncate">{item.action}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {item.resourceType || "platform"} • IP: {item.ipAddress || "system"}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0 text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{timeStr || dateStr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
