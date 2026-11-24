import { useDraggable } from '@dnd-kit/core';
import { MapPin } from 'lucide-react';
import type { TimetableCourseInfo, TimetableSlot, LogStatus } from '@/lib/api';
import { dragIdForSlot } from '@/lib/timetable';

interface ModuleChipProps {
  slot: TimetableSlot;
  course: TimetableCourseInfo;
  isCancelled: boolean;
  logStatus: LogStatus | null;
  showLogBadge?: boolean;
  onOpenMenu: () => void;
  menuOpen: boolean;
}

/** Draggable module card sitting inside a slot cell. */
export function ModuleChip({ slot, course, isCancelled, logStatus, showLogBadge = false, onOpenMenu, menuOpen }: ModuleChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragIdForSlot(slot, course),
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => e.preventDefault()}
      className={`draggable-item relative h-full rounded-2xl border p-3 pr-9 text-left transition-all cursor-grab active:cursor-grabbing select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
        isDragging ? 'opacity-30' : ''
      } ${
        isCancelled
          ? 'border-rose-500/30 bg-rose-950/40'
          : 'border-white/15 bg-slate-900/70 hover:bg-slate-800/60'
      }`}
    >
      <div className={`flex items-start justify-between gap-2 ${isCancelled ? 'opacity-60 line-through' : ''}`}>
        <div className="min-w-0">
          <span className="text-[10px] font-mono font-semibold text-indigo-300">{course.code}</span>
          <p className="text-xs font-bold text-white truncate mt-0.5">{course.name}</p>
        </div>
      </div>

      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-slate-400 min-w-0">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">{slot.venue ?? 'No venue'}</span>
        </span>
        {showLogBadge && logStatus && <LogBadge status={logStatus} />}
      </div>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu();
        }}
        aria-label="Cell options"
        className={`absolute top-2 right-2 rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
          menuOpen ? 'text-white bg-white/10' : ''
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
    </div>
  );
}

export function LogBadge({ status }: { status: LogStatus | null }) {
  if (!status) return null;
  const styles = {
    ATTENDED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    GHOST: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    SKIPPED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    CANCELLED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  } as const;
  const labels = { ATTENDED: 'Attended', GHOST: 'Ghost', SKIPPED: 'Skipped', CANCELLED: 'Off' } as const;
  return (
    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
