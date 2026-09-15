import React from 'react';
import { Clock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
}

export type WeeklyOpeningHours = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  DaySchedule
>;

interface OpeningHoursEditorProps {
  value: WeeklyOpeningHours;
  onChange: (updated: WeeklyOpeningHours) => void;
  disabled?: boolean;
}

const DAYS: { key: keyof WeeklyOpeningHours; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export const OpeningHoursEditor: React.FC<OpeningHoursEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const handleDayChange = (
    day: keyof WeeklyOpeningHours,
    field: keyof DaySchedule,
    val: any
  ) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: val,
      },
    });
  };

  const applyMondayToWeekdays = () => {
    const monday = value.monday;
    onChange({
      ...value,
      tuesday: { ...monday },
      wednesday: { ...monday },
      thursday: { ...monday },
      friday: { ...monday },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#e6a8d6]" />
          <h4 className="text-xs font-semibold text-white">Opening & Closing Schedule</h4>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={applyMondayToWeekdays}
            className="text-[11px] text-[#e6a8d6] hover:bg-[#714b67]/20 h-7 px-2"
          >
            <Copy className="w-3 h-3 mr-1" />
            Apply Mon to all weekdays
          </Button>
        )}
      </div>

      <div className="divide-y divide-white/5 border border-white/10 rounded-xl bg-black/20 overflow-hidden">
        {DAYS.map(({ key, label }) => {
          const schedule = value[key] || { open: '08:00', close: '18:00', closed: false };
          const isClosed = schedule.closed;

          return (
            <div
              key={key}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3 transition-colors',
                isClosed ? 'bg-rose-500/5' : 'hover:bg-white/[0.02]'
              )}
            >
              <div className="flex items-center justify-between sm:w-36">
                <span className="text-xs font-medium text-slate-200">{label}</span>
                <label className="relative inline-flex items-center cursor-pointer sm:hidden">
                  <input
                    type="checkbox"
                    checked={!isClosed}
                    onChange={(e) => handleDayChange(key, 'closed', !e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-[#714b67]" />
                </label>
              </div>

              <div className="flex items-center gap-3">
                {isClosed ? (
                  <span className="text-xs text-rose-400 font-medium py-1 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    Closed
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={schedule.open}
                      onChange={(e) => handleDayChange(key, 'open', e.target.value)}
                      disabled={disabled || isClosed}
                      className="w-28 h-8 text-xs bg-black/40 border-white/10 text-white rounded-lg focus:border-[#714b67]"
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <Input
                      type="time"
                      value={schedule.close}
                      onChange={(e) => handleDayChange(key, 'close', e.target.value)}
                      disabled={disabled || isClosed}
                      className="w-28 h-8 text-xs bg-black/40 border-white/10 text-white rounded-lg focus:border-[#714b67]"
                    />
                  </div>
                )}

                <label className="hidden sm:inline-flex relative items-center cursor-pointer ml-3">
                  <input
                    type="checkbox"
                    checked={!isClosed}
                    onChange={(e) => handleDayChange(key, 'closed', !e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#714b67]" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
