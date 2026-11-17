import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import { timetableSlots, noonBreak } from '@/lib/api';
import {
  buildGrid,
  DAY_LABELS,
  dayOfWeekOf,
  mondayOf,
  parseCellDroppableId,
  parseDragId,
  unplacedCourses,
  type GridCell,
} from '@/lib/timetable';
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

export function TimetableBoard({ timetable }: TimetableBoardProps) {
  const {
    courses, slots, swapMap, today, loading, error, actionError, clearActionError, busy,
    place, move, unassign, setVenue, toggleCancelled, toggleSwap, logForCell, refetch,
  } = timetable;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [venueEdit, setVenueEdit] = useState<{ slotId: string; code: string; venue: string } | null>(null);

  const todayDow = dayOfWeekOf(new Date());
  const isSchoolDay = todayDow <= 5;
  const grid = useMemo(() => buildGrid(slots, swapMap), [slots, swapMap]);
  const paletteCourses = useMemo(() => unplacedCourses(courses, slots, swapMap), [courses, slots, swapMap]);
  const todayStatusMap = useMemo(() => {
    const map = new Map<string, 'ATTENDED' | 'SKIPPED' | 'CANCELLED'>();
    for (const t of today) {
      if (t.logStatus) map.set(`${t.dayOfWeek}:${t.startTime}`, t.logStatus);
    }
    return map;
  }, [today]);

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
        // Replace: occupant goes back to the palette, dragged module takes the cell.
        const done = await unassign(occupant.id);
        if (done) void place(active.courseId, target.dayOfWeek, target.slotIndex);
      }
      return;
    }

    // Dragging a placed module. active.courseId is what the source cell displays this week.
    const sourceCell = grid.flat().find((c) => c.slot?.id === active.slotId) ?? null;
    if (!sourceCell) return;
    if (sourceCell.dayOfWeek === target.dayOfWeek && sourceCell.slotIndex === target.slotIndex) return;

    const draggedCell = sourceCell.cell!;
    const draggedBaseSlotId = draggedCell.baseSlotId;

    if (!targetCell.slot) {
      if (draggedBaseSlotId === draggedCell.slot.id) {
        void move(draggedCell.slot.id, target.dayOfWeek, target.slotIndex);
      } else {
        // Source cell shows a swapped-in module: revert the swap, then move its base slot.
        const swap = swapMap.get(draggedCell.slot.id);
        if (!swap) return;
        const reverted = await toggleSwap(swap.slotAId, swap.slotBId);
        if (reverted) void move(draggedBaseSlotId, target.dayOfWeek, target.slotIndex);
      }
      return;
    }

    const targetSlot = targetCell.slot;
    if (draggedBaseSlotId === targetSlot.id) return;

    // Weekly swap: exchanged for this week only. Re-swapping the same pair reverts it.
    void toggleSwap(draggedBaseSlotId, targetSlot.id);
  };

  const weekStart = mondayOf(new Date());

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
            <ArrowLeftRight size={13} className="text-indigo-300" />
            <span>
              Week of <span className="font-semibold text-slate-200">{weekStart}</span>
              <span className="text-slate-500"> · swaps apply to this week only</span>
            </span>
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

        <div className="flex gap-4">
          <ModulePalette courses={paletteCourses} dragActive={Boolean(dragPreview)} />

          {/* Grid: time column + 5 day columns */}
          <div
            className="grid min-w-0 flex-1 gap-2"
            style={{ gridTemplateColumns: '92px repeat(5, minmax(0, 1fr))' }}
          >
            {/* Header row */}
            <div />
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                className={`pb-1 text-center text-xs font-bold tracking-wide ${
                  isSchoolDay && todayDow === i + 1 ? 'text-indigo-300' : 'text-slate-400'
                }`}
              >
                {label}
                {isSchoolDay && todayDow === i + 1 && (
                  <span className="ml-1 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold">Today</span>
                )}
              </div>
            ))}

            {/* Slot rows, with the noon break between slots 2 and 3 */}
            {timetableSlots.map((def, defIndex) => (
              <SlotRowGroup
                key={def.index}
                defIndex={defIndex}
                cells={grid[defIndex]}
                todayDow={isSchoolDay ? todayDow : -1}
                todayStatusMap={todayStatusMap}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                dragActive={Boolean(dragPreview)}
                onLog={(cell, status) => {
                  const course = cell.cell?.course;
                  if (course) void logForCell(course.id, cell.slotIndex, status);
                }}
                onToggleCancelClass={(cell) => {
                  if (cell.cell) void toggleCancelled(cell.cell.slot.id, !cell.cell.slot.isCancelled);
                }}
                onEditVenue={(cell) => {
                  if (cell.cell) {
                    setVenueEdit({
                      slotId: cell.cell.slot.id,
                      code: cell.cell.course.code,
                      venue: cell.cell.slot.venue ?? '',
                    });
                  }
                }}
                onRemove={(cell) => {
                  if (cell.cell) void unassign(cell.cell.slot.id);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {createPortal(
        <DragOverlay dropAnimation={null}>
          {dragPreview && (
            <div className="rounded-2xl border border-indigo-400/40 bg-slate-800/90 px-3 py-2 shadow-2xl backdrop-blur-md">
              <span className="text-[10px] font-mono font-semibold text-indigo-300">{dragPreview.code}</span>
              <p className="text-xs font-bold text-white">{dragPreview.name}</p>
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
            const ok = await setVenue(venueEdit.slotId, venue.trim() || null);
            if (ok) setVenueEdit(null);
          }}
        />
      )}
    </DndContext>
  );
}

interface SlotRowGroupProps {
  defIndex: number;
  cells: GridCell[];
  todayDow: number;
  todayStatusMap: Map<string, 'ATTENDED' | 'SKIPPED' | 'CANCELLED'>;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  dragActive: boolean;
  onLog: (cell: GridCell, status: 'ATTENDED' | 'SKIPPED' | 'CANCELLED') => void;
  onToggleCancelClass: (cell: GridCell) => void;
  onEditVenue: (cell: GridCell) => void;
  onRemove: (cell: GridCell) => void;
}

function SlotRowGroup({
  defIndex,
  cells,
  todayDow,
  todayStatusMap,
  openMenu,
  setOpenMenu,
  dragActive,
  onLog,
  onToggleCancelClass,
  onEditVenue,
  onRemove,
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
        return (
          <SlotCell
            key={menuId}
            cell={cell}
            isToday={cell.dayOfWeek === todayDow}
            logStatus={todayStatusMap.get(`${cell.dayOfWeek}:${cell.startTime}`) ?? null}
            dragActive={dragActive}
            menuOpen={openMenu === menuId}
            onToggleMenu={() => setOpenMenu(openMenu === menuId ? null : menuId)}
            onCloseMenu={() => setOpenMenu(null)}
            onLog={(status) => onLog(cell, status)}
            onToggleCancelClass={() => onToggleCancelClass(cell)}
            onEditVenue={() => onEditVenue(cell)}
            onRemove={() => onRemove(cell)}
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
