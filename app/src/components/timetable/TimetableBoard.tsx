import { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDndSensors } from '@/hooks/useDndSensors';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import {
  GlassButton,
} from '@/components/glassyui/glass-button';
import { GlassSheet } from '@/components/ui/GlassSheet';
import {
  timetableSlots, noonBreak, type LogStatus, api,
} from '@/lib/api';
import {
  buildGrid,
  DAY_LABELS,
  DAY_SHORT_LABELS,
  dayOfWeekOf,
  parseCellDroppableId,
  parseDragId,
  unplacedCourses,
  type GridCell,
  weekStartOf,
  dateForDay,
  formatDayHeader,
  formatWeekRange,
  formatDayFull,
} from '@/lib/timetable';
import { hapticAction, hapticWarning } from '@/lib/haptics';
import type { TimetableController } from '@/hooks/useTimetable';
import { ModulePalette } from './ModulePalette';
import { SlotCell } from './SlotCell';

interface TimetableBoardProps {
  timetable: TimetableController;
}

interface DragPreview {
  code: string;
  name: string;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export function TimetableBoard({ timetable }: TimetableBoardProps) {
  const {
    courses, slots, swapMap, loading, error, actionError, clearActionError, busy,
    place, move, unassign, setVenue, toggleCancelled, toggleSwap, logForCell, refetch,
  } = timetable;

  const sensors = useDndSensors();
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [venueEdit, setVenueEdit] = useState<{ slotId: string; code: string; venue: string } | null>(null);

  // ── Week offset state ──────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekLogs, setWeekLogs] = useState<Map<string, LogStatus>>(new Map());
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [openSheet, setOpenSheet] = useState<{ cell: GridCell; date: string } | null>(null);

  const todayDow = dayOfWeekOf(new Date());
  const isSchoolDay = todayDow <= 5;
  const isDesktop = useIsDesktop();

  const weekStart = weekStartOf(new Date(), weekOffset);
  const weekDates = DAY_LABELS.map((_label, i) => dateForDay(weekStart, i + 1));
  const startDate = weekDates[0];
  const endDate = weekDates[4];
  const weekRangeLabel = formatWeekRange(startDate, endDate);

  const grid = useMemo(() => buildGrid(slots, swapMap), [slots, swapMap]);
  const paletteCourses = useMemo(() => unplacedCourses(courses, slots, swapMap), [courses, slots, swapMap]);

  // ── Fetch logs for the visible week ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const logMap = new Map<string, LogStatus>();
        const holidaySet = new Set<string>();

        for (const course of courses) {
          try {
            const logs = await api.getLogs(course.id);
            for (const log of logs) {
              if (log.logDate < startDate || log.logDate > endDate) continue;
              const key = `${log.courseId}|${log.logDate}|${log.slotTime ?? ''}`;
              logMap.set(key, log.status);
              if (log.status === 'CANCELLED') {
                holidaySet.add(log.logDate);
              }
            }
          } catch {
            // Individual course log fetch failure is non-fatal
          }
        }

        if (!cancelled) {
          setWeekLogs(logMap);
          setHolidayDates(holidaySet);
        }
      } catch {
        // ignore
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [courses, startDate, endDate]);

  // ── Derive per-cell log status from week logs ───────────────────────
  const cellLogStatus = useCallback((cell: GridCell): LogStatus | null => {
    if (!cell.cell) return null;
    const cellDate = dateForDay(weekStart, cell.dayOfWeek);
    const key = `${cell.cell.course.id}|${cellDate}|${cell.startTime}`;
    return weekLogs.get(key) ?? null;
  }, [weekLogs, weekStart]);

  const isHolidayDate = useCallback((date: string): boolean => {
    return holidayDates.has(date);
  }, [holidayDates]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/15 bg-slate-900/40 p-12 text-center">
        <p className="text-sm text-slate-400">Loading timetable…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-slate-900/40 p-12 text-center">
        <h3 className="text-xl font-bold text-white">API Offline</h3>
        <p className="mt-2 text-sm text-rose-400">{error}</p>
        <p className="mt-1 text-xs text-slate-500">Make sure the Kontrol API is running on port 3001.</p>
      </div>
    );
  }

  const findCell = (dayOfWeek: number, slotIndex: number) =>
    grid[slotIndex - 1]?.find((c) => c.dayOfWeek === dayOfWeek) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    const payload = parseDragId(String(event.active.id));
    if (!payload) return;
    if (payload.kind === 'course') {
      const course = courses.find((c) => c.id === payload.courseId);
      if (course) setDragPreview({ code: course.code, name: course.name });
      return;
    }
    const sourceCell = grid.flat().find((c) => c.slot?.id === payload.slotId);
    if (sourceCell?.cell) {
      setDragPreview({ code: sourceCell.cell.course.code, name: sourceCell.cell.course.name });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragPreview(null);
    setOpenMenu(null);

    const active = parseDragId(String(event.active.id));
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!active || !overId) return;

    if (overId === 'palette') {
      if (active.kind === 'slot') void unassign(active.slotId);
      return;
    }

    const target = parseCellDroppableId(overId);
    if (!target) return;
    const targetCell = findCell(target.dayOfWeek, target.slotIndex);
    if (!targetCell) return;

    if (active.kind === 'course') {
      const occupant = targetCell.slot;
      if (!occupant) {
        void place(active.courseId, target.dayOfWeek, target.slotIndex);
      } else if (occupant.courseId === active.courseId || targetCell.cell?.course.id === active.courseId) {
        return;
      } else {
        await unassign(occupant.id);
        void place(active.courseId, target.dayOfWeek, target.slotIndex);
      }
      return;
    }

    const sourceCell = grid.flat().find((c) => c.slot?.id === active.slotId) ?? null;
    if (!sourceCell) return;
    if (sourceCell.dayOfWeek === target.dayOfWeek && sourceCell.slotIndex === target.slotIndex) return;

    const draggedCell = sourceCell.cell!;
    const draggedBaseSlotId = draggedCell.baseSlotId;

    if (!targetCell.slot) {
      if (draggedBaseSlotId === draggedCell.slot.id) {
        void move(draggedCell.slot.id, target.dayOfWeek, target.slotIndex);
      } else {
        const swap = swapMap.get(draggedCell.slot.id);
        if (!swap) return;
        await toggleSwap(swap.slotAId, swap.slotBId);
        void move(draggedBaseSlotId, target.dayOfWeek, target.slotIndex);
      }
      return;
    }

    const targetSlot = targetCell.slot;
    if (draggedBaseSlotId === targetSlot.id) return;

    void toggleSwap(draggedBaseSlotId, targetSlot.id);
  };

  // ── Handlers ────────────────────────────────────────────────────────
  const handlers = {
    onLog: (cell: GridCell, status: LogStatus) => {
      const course = cell.cell?.course;
      if (course) {
        const cellDate = dateForDay(weekStart, cell.dayOfWeek);
        void logForCell(course.id, cell.slotIndex, status, undefined, cellDate);
        void hapticAction();
      }
    },
    onToggleCancelClass: (cell: GridCell) => {
      if (cell.cell) void toggleCancelled(cell.cell.slot.id, !cell.cell.slot.isCancelled);
    },
    onEditVenue: (cell: GridCell) => {
      if (cell.cell) {
        setVenueEdit({
          slotId: cell.cell.slot.id,
          code: cell.cell.course.code,
          venue: cell.cell.slot.venue ?? '',
        });
      }
    },
    onRemove: (cell: GridCell) => {
      if (cell.cell) void unassign(cell.cell.slot.id);
    },
    onSlotClick: (cell: GridCell) => {
      if (!cell.cell) return;
      const cellDate = dateForDay(weekStart, cell.dayOfWeek);
      setOpenSheet({ cell, date: cellDate });
    },
  };

  // ── Holiday actions ─────────────────────────────────────────────────
  const markHoliday = useCallback(async (dayOfWeek: number, date: string) => {
    const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek && !s.isCancelled);
    if (daySlots.length === 0) return;

    // Optimistically add holiday logs
    const newLogs: Array<{ courseId: string; date: string; status: LogStatus }> = [];
    for (const slot of daySlots) {
      newLogs.push({ courseId: slot.courseId, date, status: 'CANCELLED' });
      const key = `${slot.courseId}|${date}|${slot.startTime}`;
      weekLogs.set(key, 'CANCELLED');
    }
    setWeekLogs(new Map(weekLogs));
    setHolidayDates(new Set([...holidayDates, date]));

    // Fire all API calls in background
    await Promise.all(daySlots.map((slot) =>
      api.logAttendance(slot.courseId, 'CANCELLED', undefined, { logDate: date, slotTime: slot.startTime }).catch(() => undefined)
    ));
    void hapticAction();
  }, [slots, weekLogs, holidayDates]);

  const undoHoliday = useCallback(async (date: string) => {
    const daySlots = slots.filter((s) => {
      const cellDate = dateForDay(weekStart, s.dayOfWeek);
      return cellDate === date && !s.isCancelled;
    });

    // Optimistically remove
    for (const slot of daySlots) {
      const key = `${slot.courseId}|${date}|${slot.startTime}`;
      weekLogs.delete(key);
    }
    setWeekLogs(new Map(weekLogs));
    setHolidayDates(new Set([...holidayDates].filter((d) => d !== date)));

    await Promise.all(daySlots.map((slot) =>
      api.deleteLog(slot.courseId, date, 'CANCELLED').catch(() => undefined)
    ));
    void hapticAction();
  }, [slots, weekStart, holidayDates, dateForDay]);

  // ── Slot action sheet ───────────────────────────────────────────────
  const renderSlotSheet = () => {
    if (!openSheet) return null;
    const { cell, date } = openSheet;
    const course = cell.cell!.course;
    const slot = cell.cell!.slot;
    const cancelled = slot.isCancelled;
    const currentStatus = cellLogStatus(cell);

    return (
      <GlassSheet
        open={Boolean(openSheet)}
        onClose={() => setOpenSheet(null)}
        title={course.code}
        subtitle={`${formatDayFull(date)} • ${slot.startTime}–${slot.endTime}${slot.venue ? ` • ${slot.venue}` : ''}`}
        side="bottom"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">Current status</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {currentStatus ? currentStatus.charAt(0) + currentStatus.slice(1).toLowerCase() : 'None'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => { handlers.onLog(cell, 'ATTENDED'); setOpenSheet(null); }}
              className="text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
            >
              Attend
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                if (courses.find((c) => c.id === course.id)?.remainingSkips ?? 0 <= 1) void hapticWarning();
                else void hapticAction();
                handlers.onLog(cell, 'SKIPPED');
                setOpenSheet(null);
              }}
              className="text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
            >
              Skip
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => { handlers.onLog(cell, 'GHOST'); setOpenSheet(null); }}
              className="text-violet-400 border-violet-500/20 hover:bg-violet-500/10"
            >
              Ghost
            </GlassButton>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                void markHoliday(cell.dayOfWeek, date);
                setOpenSheet(null);
              }}
              className={`text-amber-400 border-amber-500/20 hover:bg-amber-500/10 ${cancelled ? 'opacity-50' : ''}`}
              disabled={cancelled}
            >
              {cancelled ? 'Holiday (on)' : 'Holiday'}
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                handleClearLog(cell);
                setOpenSheet(null);
              }}
              className="text-slate-400 border-white/10 hover:bg-white/10"
              disabled={!currentStatus}
            >
              Clear Log
            </GlassButton>
          </div>

          {cancelled && (
            <div className="pt-2 border-t border-white/10">
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => { void undoHoliday(date); setOpenSheet(null); }}
                className="w-full text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
              >
                Undo Holiday for this date
              </GlassButton>
            </div>
          )}
        </div>
      </GlassSheet>
    );
  };

  // Clear Log handler: treat as deleting the log for that cell/date
  const handleClearLog = useCallback((cell: GridCell) => {
    if (!cell.cell) return;
    const cellDate = dateForDay(weekStart, cell.dayOfWeek);
    void api.deleteLog(cell.cell.course.id, cellDate, 'CANCELLED').catch(() => undefined);
    const key = `${cell.cell.course.id}|${cellDate}|${cell.startTime}`;
    weekLogs.delete(key);
    setWeekLogs(new Map(weekLogs));
    void hapticAction();
  }, [weekLogs, weekStart]);

  // Wrap onLog to handle CLEAR
  const originalOnLog = handlers.onLog;
  const onLogWithClear = (cell: GridCell, status: LogStatus | 'CLEAR') => {
    if (status === 'CLEAR') {
      handleClearLog(cell);
      return;
    }
    originalOnLog(cell, status as LogStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragPreview(null)}
    >
      <div className="space-y-4">
        {/* Week banner */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="rounded-lg p-1.5 text-indigo-300 hover:bg-white/10 transition-all"
              disabled={weekOffset <= 0}
            >
              <ArrowLeftRight size={13} />
            </button>
            <span className="font-semibold text-slate-200">{weekRangeLabel}</span>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="rounded-lg p-1.5 text-indigo-300 hover:bg-white/10 transition-all"
            >
              <ArrowLeftRight size={13} className="rotate-180" />
            </button>
            <span className="ml-3 text-xs text-slate-500">· swaps apply to this week only</span>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {actionError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <span>{actionError}</span>
            <button type="button" onClick={clearActionError} className="shrink-0 text-rose-200 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {isDesktop ? (
          <div className="flex gap-4">
            <ModulePalette courses={paletteCourses} dragActive={Boolean(dragPreview)} />

            <div
              className="grid min-w-0 flex-1 gap-2"
              style={{ gridTemplateColumns: '92px repeat(5, minmax(0, 1fr))' }}
            >
              {/* Header row */}
              <div />
              {DAY_LABELS.map((label, i) => {
                const dayOfWeek = i + 1;
                const date = weekDates[i];
                const isToday = isSchoolDay && todayDow === dayOfWeek;
                const isHoliday = isHolidayDate(date);
                return (
                  <div
                    key={label}
                    className={`pb-1 text-center text-xs font-bold tracking-wide rounded-t-xl px-2 py-1.5 transition-colors
                      ${isHoliday
                        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                        : isToday
                        ? 'text-indigo-300 border-b border-indigo-400/50'
                        : 'text-slate-400'
                      }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{formatDayHeader(date)}</span>
                      <span className="text-[9px] opacity-70">{DAY_SHORT_LABELS[i]}</span>
                      {isToday && (
                        <span className="ml-0.5 rounded-full bg-indigo-500/20 px-1.5 py-0 text-[8px] font-semibold">Today</span>
                      )}
                      {isHoliday && (
                        <span className="ml-0.5 rounded-full bg-amber-500/20 px-1.5 py-0 text-[8px] font-semibold text-amber-400">Holiday</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void markHoliday(dayOfWeek, date);
                      }}
                      className="mt-1.5 shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-all"
                    >
                      {isHoliday ? 'Undo Holiday' : 'Mark Holiday'}
                    </button>
                  </div>
                );
              })}

              {/* Slot rows, with the noon break between slots 2 and 3 */}
              {timetableSlots.map((def, defIndex) => (
                <SlotRowGroup
                  key={def.index}
                  defIndex={defIndex}
                  cells={grid[defIndex]}
                  todayDow={isSchoolDay ? todayDow : -1}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  dragActive={Boolean(dragPreview)}
                  handlers={{ ...handlers, onLog: onLogWithClear }}
                  weekStart={weekStart}
                  cellLogStatus={cellLogStatus}
                  isHolidayDate={isHolidayDate}
                />
              ))}
            </div>
          </div>
        ) : (
          <MobileBoard
            grid={grid}
            paletteCourses={paletteCourses}
            dragActive={Boolean(dragPreview)}
            todayDow={isSchoolDay ? todayDow : -1}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            handlers={{ ...handlers, onLog: onLogWithClear }}
            weekStart={weekStart}
            cellLogStatus={cellLogStatus}
            isHolidayDate={isHolidayDate}
            weekDates={weekDates}
          />
        )}
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {dragPreview && (
            <div className="rounded-2xl border border-indigo-400/50 bg-[#161b2e]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md scale-[1.03] select-none">
              <span className="text-[10px] font-mono font-semibold text-indigo-300">{dragPreview.code}</span>
              <p className="text-xs font-bold text-white leading-tight">{dragPreview.name}</p>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}

      {venueEdit && (
        <VenueEditModal
          code={venueEdit.code}
          initialVenue={venueEdit.venue}
          busy={busy}
          onClose={() => setVenueEdit(null)}
          onSave={async (venue) => {
            await setVenue(venueEdit.slotId, venue.trim() || null);
            setVenueEdit(null);
          }}
        />
      )}

      {renderSlotSheet()}
    </DndContext>
  );
}

interface CellHandlers {
  onLog: (cell: GridCell, status: LogStatus) => void;
  onToggleCancelClass: (cell: GridCell) => void;
  onEditVenue: (cell: GridCell) => void;
  onRemove: (cell: GridCell) => void;
  onSlotClick: (cell: GridCell) => void;
}

interface SlotRowGroupProps {
  defIndex: number;
  cells: GridCell[];
  todayDow: number;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  dragActive: boolean;
  handlers: CellHandlers;
  weekStart: string;
  cellLogStatus: (cell: GridCell) => LogStatus | null;
  isHolidayDate: (date: string) => boolean;
}

function SlotRowGroup({
  defIndex,
  cells,
  todayDow,
  openMenu,
  setOpenMenu,
  dragActive,
  handlers,
  weekStart,
  cellLogStatus,
  isHolidayDate,
}: SlotRowGroupProps) {
  const def = timetableSlots[defIndex];
  const breakBefore = defIndex === 2;

  return (
    <>
      {breakBefore && (
        <div className="col-span-6 my-1 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-1.5">
          <span className="text-[10px] font-mono text-slate-500">
            {noonBreak.startTime} - {noonBreak.endTime}
          </span>
          <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Noon Break</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>
      )}

      {/* Time label */}
      <div className="flex flex-col justify-center px-1 text-right">
        <span className="font-mono text-[11px] text-slate-400">{def.startTime}</span>
        <span className="font-mono text-[10px] text-slate-600">{def.endTime}</span>
      </div>

      {cells.map((cell) => {
        const menuId = `${cell.dayOfWeek}:${cell.slotIndex}`;
        const cellDate = dateForDay(weekStart, cell.dayOfWeek);
        const isHoliday = isHolidayDate(cellDate);
        return (
          <SlotCell
            key={menuId}
            cell={cell}
            isToday={cell.dayOfWeek === todayDow}
            logStatus={cellLogStatus(cell)}
            dragActive={dragActive}
            menuOpen={openMenu === menuId}
            onToggleMenu={() => setOpenMenu(openMenu === menuId ? null : menuId)}
            onCloseMenu={() => setOpenMenu(null)}
            onLog={(status) => handlers.onLog(cell, status)}
            onToggleCancelClass={() => handlers.onToggleCancelClass(cell)}
            onEditVenue={() => handlers.onEditVenue(cell)}
            onRemove={() => handlers.onRemove(cell)}
            onSlotClick={() => handlers.onSlotClick(cell)}
            isHoliday={isHoliday}
          />
        );
      })}
    </>
  );
}

function VenueEditModal({
  code,
  initialVenue,
  busy,
  onClose,
  onSave,
}: {
  code: string;
  initialVenue: string;
  busy: boolean;
  onClose: () => void;
  onSave: (venue: string) => void;
}) {
  const [venue, setVenue] = useState(initialVenue);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900/80 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Edit venue</h3>
          <p className="text-xs text-slate-400 mt-0.5">{code}</p>
        </div>
        <input
          autoFocus
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(venue);
            if (e.key === 'Escape') onClose();
          }}
          placeholder="e.g. Lab 204"
          maxLength={50}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
        />
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(venue)}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MobileBoardProps {
  grid: GridCell[][];
  paletteCourses: TimetableController['courses'];
  dragActive: boolean;
  todayDow: number;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  handlers: CellHandlers;
  weekStart: string;
  cellLogStatus: (cell: GridCell) => LogStatus | null;
  isHolidayDate: (date: string) => boolean;
  weekDates: string[];
}

/** <768px: days stack vertically, palette wraps on top. Drag works across all days. */
function MobileBoard({
  grid,
  paletteCourses,
  dragActive,
  todayDow,
  openMenu,
  setOpenMenu,
  handlers,
  weekStart,
  cellLogStatus,
  isHolidayDate,
  weekDates,
}: MobileBoardProps) {
  return (
    <div className="space-y-3">
      <ModulePalette courses={paletteCourses} dragActive={dragActive} compact />

      {DAY_SHORT_LABELS.map((label, dayIndex) => {
        const day = dayIndex + 1;
        const date = weekDates[dayIndex];
        const isToday = day === todayDow;
        const isHoliday = isHolidayDate(date);
        return (
          <div key={day} className={`rounded-2xl border p-2 transition-colors
            ${isHoliday ? 'border-amber-500/20 bg-amber-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold tracking-wide ${isToday ? 'text-indigo-300' : isHoliday ? 'text-amber-400' : 'text-slate-300'}`}>
                  {label}
                  {isToday && (
                    <span className="ml-1.5 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold">Today</span>
                  )}
                  {isHoliday && (
                    <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">Holiday</span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{formatDayHeader(date)}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handlers.onLog({} as GridCell, 'ATTENDED');
                }}
                className={`shrink-0 rounded-xl border px-2 py-0.5 text-[9px] font-semibold transition-all
                  ${isHoliday
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    : 'border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {isHoliday ? 'Undo' : 'Holiday'}
              </button>
            </div>

            <div className="space-y-2">
              {grid.map((slotRow, defIndex) => (
                <MobileSlotRow
                  key={slotRow[0]?.slotIndex ?? defIndex}
                  defIndex={defIndex}
                  cell={slotRow[dayIndex]}
                  isToday={isToday}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  dragActive={dragActive}
                  handlers={handlers}
                  weekStart={weekStart}
                  cellLogStatus={cellLogStatus}
                  isHolidayDate={isHolidayDate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MobileSlotRowProps {
  defIndex: number;
  cell: GridCell;
  isToday: boolean;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  dragActive: boolean;
  handlers: CellHandlers;
  weekStart: string;
  cellLogStatus: (cell: GridCell) => LogStatus | null;
  isHolidayDate: (date: string) => boolean;
}

function MobileSlotRow({
  defIndex,
  cell,
  isToday,
  openMenu,
  setOpenMenu,
  dragActive,
  handlers,
  weekStart,
  cellLogStatus,
  isHolidayDate,
}: MobileSlotRowProps) {
  const def = timetableSlots[defIndex];
  const menuId = `${cell.dayOfWeek}:${cell.slotIndex}`;
  const cellDate = dateForDay(weekStart, cell.dayOfWeek);
  const isHoliday = isHolidayDate(cellDate);

  return (
    <>
      {defIndex === 2 && (
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1">
          <span className="font-mono text-[9px] text-slate-500">
            {noonBreak.startTime} - {noonBreak.endTime}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Noon Break</span>
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <div className="flex w-11 shrink-0 flex-col justify-center text-right">
          <span className="font-mono text-[10px] text-slate-400">{def.startTime}</span>
          <span className="font-mono text-[9px] text-slate-600">{def.endTime}</span>
        </div>
        <div className="min-w-0 flex-1">
          <SlotCell
            cell={cell}
            isToday={isToday}
            logStatus={cellLogStatus(cell)}
            dragActive={dragActive}
            menuOpen={openMenu === menuId}
            onToggleMenu={() => setOpenMenu(openMenu === menuId ? null : menuId)}
            onCloseMenu={() => setOpenMenu(null)}
            onLog={(status) => handlers.onLog(cell, status)}
            onToggleCancelClass={() => handlers.onToggleCancelClass(cell)}
            onEditVenue={() => handlers.onEditVenue(cell)}
            onRemove={() => handlers.onRemove(cell)}
            onSlotClick={() => handlers.onSlotClick(cell)}
            isHoliday={isHoliday}
          />
        </div>
      </div>
    </>
  );
}
