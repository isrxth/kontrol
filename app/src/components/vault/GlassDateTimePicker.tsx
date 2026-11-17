import { useState, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface GlassDateTimePickerProps {
  date: string; // 'YYYY-MM-DD' or ''
  time: string; // 'HH:MM' or ''
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const TIME_PRESETS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '03:00 PM', value: '15:00' },
  { label: '06:00 PM', value: '18:00' },
  { label: '11:59 PM', value: '23:59' },
];

export function GlassDateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
}: GlassDateTimePickerProps) {
  const [openTab, setOpenTab] = useState<'date' | 'time' | null>(null);

  // Calendar navigation state (year & month)
  const initialDate = useMemo(() => {
    if (date) {
      const [y, m] = date.split('-').map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [date]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-11

  const todayStr = useMemo(() => toYMD(new Date()), []);

  // Compute calendar grid
  const daysGrid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // 0 = Sunday, 1 = Monday ... convert so Monday is 0, Sunday is 6
    const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
      cells.push({
        dateStr: toYMD(prevDate),
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(viewYear, viewMonth, d);
      cells.push({
        dateStr: toYMD(curDate),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days to fill 7 columns (up to multiple of 7)
    const totalCells = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      cells.push({
        dateStr: toYMD(nextDate),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onDateChange(todayStr);
  };

  const handleQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    onDateChange(toYMD(d));
  };

  // Split current time into hours and minutes
  const [hourStr, minuteStr] = useMemo(() => {
    if (!time || !time.includes(':')) return ['', ''];
    return time.split(':');
  }, [time]);

  const handleHourChange = (newHour: string) => {
    const m = minuteStr || '00';
    onTimeChange(`${pad(Number(newHour))}:${pad(Number(m))}`);
  };

  const handleMinuteChange = (newMin: string) => {
    const h = hourStr || '12';
    onTimeChange(`${pad(Number(h))}:${pad(Number(newMin))}`);
  };

  return (
    <div className="space-y-2">
      {/* Trigger Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Date Trigger */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Due date
          </span>
          <div
            onClick={() => setOpenTab(openTab === 'date' ? null : 'date')}
            className={`flex items-center justify-between w-full cursor-pointer rounded-xl border px-3 py-2 text-xs transition-all ${
              openTab === 'date'
                ? 'border-indigo-400/60 bg-indigo-500/15 text-white ring-1 ring-indigo-400/30'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Calendar size={13} className={date ? 'text-indigo-400' : 'text-slate-500'} />
              <span className={date ? 'font-medium text-white truncate' : 'text-slate-500'}>
                {date ? formatDateDisplay(date) : 'Pick date'}
              </span>
            </div>
            {date ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDateChange('');
                }}
                className="rounded p-0.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear date"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Time Trigger */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Time (optional)
          </span>
          <div
            onClick={() => setOpenTab(openTab === 'time' ? null : 'time')}
            className={`flex items-center justify-between w-full cursor-pointer rounded-xl border px-3 py-2 text-xs transition-all ${
              openTab === 'time'
                ? 'border-indigo-400/60 bg-indigo-500/15 text-white ring-1 ring-indigo-400/30'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Clock size={13} className={time ? 'text-indigo-400' : 'text-slate-500'} />
              <span className={time ? 'font-medium text-white truncate' : 'text-slate-500'}>
                {time ? time : 'Set time'}
              </span>
            </div>
            {time ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTimeChange('');
                }}
                className="rounded p-0.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear time"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Expandable Glassy Panel */}
      {openTab && (
        <div className="rounded-2xl border border-white/15 bg-slate-950/80 p-3.5 backdrop-blur-xl shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Panel Tab Switcher */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setOpenTab('date')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  openTab === 'date'
                    ? 'bg-indigo-500/25 border border-indigo-400/40 text-indigo-200'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar size={12} /> Calendar
              </button>
              <button
                type="button"
                onClick={() => setOpenTab('time')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  openTab === 'time'
                    ? 'bg-indigo-500/25 border border-indigo-400/40 text-indigo-200'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Clock size={12} /> Time
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpenTab(null)}
              className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-xs"
            >
              Done
            </button>
          </div>

          {/* CALENDAR VIEW */}
          {openTab === 'date' && (
            <div className="space-y-2.5">
              {/* Month Navigation */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-white tracking-wide">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleJumpToday}
                    className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    aria-label="Next month"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center">
                {WEEKDAY_HEADERS.map((day) => (
                  <span key={day} className="text-[10px] font-semibold text-slate-500 py-0.5">
                    {day}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {daysGrid.map((cell) => {
                  const isSelected = date === cell.dateStr;
                  const isToday = todayStr === cell.dateStr;
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => onDateChange(cell.dateStr)}
                      className={`h-7 rounded-lg text-xs font-medium transition-all flex items-center justify-center relative ${
                        isSelected
                          ? 'bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/40 ring-1 ring-indigo-300'
                          : isToday
                          ? 'border border-indigo-400/50 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                          : cell.isCurrentMonth
                          ? 'text-slate-200 hover:bg-white/10 hover:text-white'
                          : 'text-slate-600 hover:bg-white/5 hover:text-slate-400'
                      }`}
                    >
                      {cell.dayNum}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-white/5">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickDate(0)}
                    className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(1)}
                    className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(7)}
                    className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    In 1 week
                  </button>
                </div>
                {date && (
                  <button
                    type="button"
                    onClick={() => onDateChange('')}
                    className="text-[10px] text-rose-400 hover:text-rose-300 px-1 py-0.5 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TIME VIEW */}
          {openTab === 'time' && (
            <div className="space-y-3">
              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Quick Presets
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onTimeChange(preset.value)}
                      className={`rounded-lg border px-1.5 py-1.5 text-[10px] font-semibold transition-all ${
                        time === preset.value
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Hours & Minutes */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Custom Time (24h)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Hour</label>
                    <select
                      value={hourStr ? pad(Number(hourStr)) : ''}
                      onChange={(e) => handleHourChange(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-400/60"
                    >
                      <option value="">--</option>
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={pad(i)}>
                          {pad(i)}:00 ({i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`})
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-slate-400 font-bold self-end pb-2">:</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Minute</label>
                    <select
                      value={minuteStr ? pad(Number(minuteStr)) : ''}
                      onChange={(e) => handleMinuteChange(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-400/60"
                    >
                      <option value="">--</option>
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                        <option key={m} value={m}>
                          :{m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Clear time */}
              {time && (
                <div className="flex justify-end pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => onTimeChange('')}
                    className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Clear time
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
