import { useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ArrowLeftRight, Ban, CalendarX2, CheckCircle2, MapPin, Plus, Trash2, XCircle, Ghost } from 'lucide-react';
import type { GridCell } from '@/lib/timetable';
import { cellDroppableId, DAY_SHORT_LABELS } from '@/lib/timetable';
import type { LogStatus } from '@/lib/api';
import { ModuleChip } from './ModuleChip';

interface SlotCellProps {
  cell: GridCell;
  isToday: boolean;
  logStatus: LogStatus | null;
  dragActive: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onLog: (status: LogStatus) => void;
  onToggleCancelClass: () => void;
  onEditVenue: () => void;
  onRemove: () => void;
}

export function SlotCell({
  cell,
  isToday,
  logStatus,
  dragActive,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onLog,
  onToggleCancelClass,
  onEditVenue,
  onRemove,
}: SlotCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellDroppableId(cell.dayOfWeek, cell.slotIndex),
  });

  const dropHighlight = isOver && dragActive;
  const showPlus = dragActive && !cell.slot;

  return (
    <div
      ref={setNodeRef}
      className={`relative h-24 md:h-28 rounded-2xl border transition-all duration-150 ${
        dropHighlight
          ? 'border-indigo-400/70 bg-indigo-500/15 ring-1 ring-indigo-400/50'
          : cell.slot
            ? 'border-white/10 bg-white/[0.03]'
            : 'border-dashed border-white/10 bg-white/[0.015] hover:border-white/20'
      }`}
    >
      {cell.cell ? (
        <ModuleChip
          slot={cell.cell.slot}
          course={cell.cell.course}
          isCancelled={cell.cell.slot.isCancelled}
          isToday={isToday}
          logStatus={logStatus}
          onOpenMenu={onToggleMenu}
          menuOpen={menuOpen}
        />
      ) : showPlus ? (
        <div className="flex h-full items-center justify-center text-slate-500">
          <Plus size={18} />
        </div>
      ) : null}

      {cell.cell?.swappedWith && (
        <div className="absolute -top-2 left-2 z-10 flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-2 py-0.5 text-[9px] font-semibold text-indigo-200 backdrop-blur-sm">
          <ArrowLeftRight size={9} />
          ⇄ {DAY_SHORT_LABELS[cell.cell.swappedWith.dayOfWeek - 1]} {cell.cell.swappedWith.startTime}
        </div>
      )}

      {menuOpen && cell.cell && (
        <CellMenu
          cell={cell}
          isToday={isToday}
          onLog={onLog}
          onToggleCancelClass={onToggleCancelClass}
          onEditVenue={onEditVenue}
          onRemove={onRemove}
          onClose={onCloseMenu}
        />
      )}
    </div>
  );
}

interface CellMenuProps {
  cell: GridCell;
  isToday: boolean;
  onLog: (status: LogStatus) => void;
  onToggleCancelClass: () => void;
  onEditVenue: () => void;
  onRemove: () => void;
  onClose: () => void;
}

function CellMenu({ cell, isToday, onLog, onToggleCancelClass, onEditVenue, onRemove, onClose }: CellMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  const effect = cell.cell!;
  const cancelled = effect.slot.isCancelled;

  return (
    <div
      ref={ref}
      className="absolute right-1 top-8 z-50 w-52 rounded-2xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
    >
      <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-mono text-slate-500 truncate">
        {effect.course.code} · {DAY_SHORT_LABELS[cell.dayOfWeek - 1]} {cell.startTime}
      </div>

      {isToday && (
        <>
          <MenuItem icon={<CheckCircle2 size={13} className="text-emerald-400" />} label="Mark attended" onClick={() => onLog('ATTENDED')} />
          <MenuItem icon={<XCircle size={13} className="text-rose-400" />} label="Mark skipped" onClick={() => onLog('SKIPPED')} />
          <MenuItem icon={<Ghost size={13} className="text-violet-400" />} label="Mark ghosted" onClick={() => onLog('GHOST')} />
          <MenuDivider />
        </>
      )}

      <MenuItem
        icon={<CalendarX2 size={13} className="text-amber-400" />}
        label={cancelled ? 'Restore class' : 'Cancel class'}
        onClick={onToggleCancelClass}
      />
      <MenuItem icon={<MapPin size={13} className="text-blue-400" />} label="Edit venue" onClick={onEditVenue} />
      <MenuItem icon={<Trash2 size={13} className="text-slate-400" />} label="Remove from timetable" onClick={onRemove} />
      {cancelled && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-rose-300/80">
          <Ban size={10} /> Cancelled on the base schedule
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
    >
      {icon}
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-white/10" />;
}
