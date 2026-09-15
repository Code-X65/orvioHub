import React, { useState } from 'react';
import { ScrollText, ChevronDown, ChevronRight, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface AuditLogRecord {
  id: string;
  eventType: string;
  action?: string;
  actorName?: string;
  actorEmail?: string;
  createdAt: number;
  ipAddress?: string;
  reason?: string;
  beforeValues?: Record<string, any>;
  afterValues?: Record<string, any>;
}

interface AuditLogTableProps {
  logs: AuditLogRecord[];
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  logs,
  isLoading = false,
  onRefresh,
  className,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'all') return true;
    return (log.eventType || log.action || '').toLowerCase().includes(filterType.toLowerCase());
  });

  const formatEventName = (raw: string) => {
    return raw
      .replace(/^workspace\./, '')
      .replace(/^branch\./, '')
      .replace(/^application\./, '')
      .replace(/_/g, ' ')
      .toUpperCase();
  };

  const getEventBadgeClass = (eventType: string) => {
    if (eventType.includes('delete') || eventType.includes('archive') || eventType.includes('suspended')) {
      return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
    }
    if (eventType.includes('create') || eventType.includes('active') || eventType.includes('restored')) {
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    }
    return 'bg-[#714b67]/20 text-[#e6a8d6] border-[#714b67]/30';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-[#e6a8d6]" />
            Audit Trail & Event History
          </h3>
          <p className="text-[11px] text-slate-400">
            Immutable log of all configuration changes and sensitive operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-8 px-2.5 bg-black/40 border border-white/10 text-slate-300 rounded-lg text-xs focus:border-[#714b67] focus:outline-none"
          >
            <option value="all">All Events</option>
            <option value="profile">Profile & General</option>
            <option value="branding">Branding</option>
            <option value="branch">Branches</option>
            <option value="localization">Localization</option>
            <option value="application">Applications</option>
          </select>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 text-xs border-white/10 hover:bg-white/5"
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Logs Table / List */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center bg-black/20 border border-white/5 rounded-xl space-y-2">
          <ScrollText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">No audit events recorded for this selection.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            const eventName = log.eventType || log.action || 'system.event';

            return (
              <div
                key={log.id}
                className="border border-white/10 rounded-xl bg-black/30 overflow-hidden transition-all"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-bold rounded-md border tracking-wider shrink-0',
                        getEventBadgeClass(eventName)
                      )}
                    >
                      {formatEventName(eventName)}
                    </span>

                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {log.reason || eventName}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {log.actorName || log.actorEmail || 'System Actor'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details / Diff Inspector */}
                {isExpanded && (
                  <div className="p-4 bg-black/60 border-t border-white/10 space-y-3 text-xs animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-400">Event ID:</span>{' '}
                        <span className="font-mono text-slate-300">{log.id}</span>
                      </div>
                      {log.ipAddress && (
                        <div>
                          <span className="text-slate-400">IP Address:</span>{' '}
                          <span className="font-mono text-slate-300">{log.ipAddress}</span>
                        </div>
                      )}
                    </div>

                    {(log.beforeValues || log.afterValues) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {log.beforeValues && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                              Previous Values
                            </span>
                            <pre className="p-3 bg-black/60 border border-white/10 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48">
                              {JSON.stringify(log.beforeValues, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.afterValues && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              Updated Values
                            </span>
                            <pre className="p-3 bg-black/60 border border-white/10 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48">
                              {JSON.stringify(log.afterValues, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
