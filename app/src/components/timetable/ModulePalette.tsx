import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, Layers, Undo2 } from 'lucide-react';
import type { CourseStats } from '@/lib/api';
import { dragIdForCourse } from '@/lib/timetable';

interface ModulePaletteProps {
  courses: CourseStats[];
  dragActive: boolean;
  /** Mobile layout: full width, chips wrap into rows. */
  compact?: boolean;
}

/** Kanban-style sidebar of modules that are not placed anywhere on the grid. */
export function ModulePalette({ courses, dragActive, compact = false }: ModulePaletteProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'palette' });

  return (
    <div
      className={
        compact
          ? 'flex flex-col rounded-3xl border border-white/10 bg-slate-900/40 p-3'
          : 'flex w-60 shrink-0 flex-col rounded-3xl border border-white/10 bg-slate-900/40 p-4'
      }
    >
      <div className="flex items-center gap-2 px-1 pb-3">
        <Layers size={14} className="text-indigo-300" />
        <h3 className="text-xs font-bold text-white tracking-wide">Modules</h3>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
          {courses.length} free
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`rounded-2xl border border-dashed p-1.5 transition-all ${
          compact ? 'min-h-14' : 'min-h-40 flex-1 space-y-2'
        } ${isOver && dragActive ? 'border-rose-400/60 bg-rose-500/10' : 'border-white/10 bg-white/[0.02]'}`}
      >
        {isOver && dragActive && (
          <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold text-rose-300">
            <Undo2 size={12} /> Drop to remove from timetable
          </div>
        )}
        <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-2'}>
          {courses.length === 0 && !dragActive && (
            <p className="w-full px-2 py-6 text-center text-[10px] text-slate-500">
              All modules are placed.
              <br />
              Drag a module here to unassign it.
            </p>
          )}
          {courses.map((course) => (
            <PaletteChip key={course.id} course={course} />
          ))}
        </div>
      </div>

      {!compact && (
        <p className="px-1 pt-3 text-[10px] leading-relaxed text-slate-500">
          Drag into a slot to schedule. Drag onto another module to swap for this week.
        </p>
      )}
    </div>
  );
}

function PaletteChip({ course }: { course: CourseStats }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragIdForCourse(course.id),
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => e.preventDefault()}
      className={`draggable-item flex cursor-grab items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-2.5 py-2 transition-all hover:bg-slate-800/60 active:cursor-grabbing select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <span className="drag-handle touch-none p-1 -m-1 flex items-center justify-center">
        <GripVertical size={14} className="shrink-0 text-slate-500" />
      </span>
      <div className="min-w-0">
        <span className="text-[10px] font-mono font-semibold text-indigo-300">{course.code}</span>
        <p className="text-xs font-bold text-white truncate leading-tight">{course.name}</p>
      </div>
    </div>
  );
}
