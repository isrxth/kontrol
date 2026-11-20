import { ShieldCheck, CheckCircle, Ghost, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CourseStats, LogStatus } from '@/lib/api';

interface QuickActionsRowProps {
  selectedCourse: CourseStats | null;
  onLogAttendance: (courseId: string, status: LogStatus) => void;
  onOpenTimetable: () => void;
  onAddTask?: () => void;
}

const ACTIONS: {
  id: LogStatus | 'timetable';
  icon: LucideIcon;
  label: string;
  iconColor: string;
  activeBorder: string;
}[] = [
  {
    id: 'SKIPPED',
    icon: ShieldCheck,
    label: 'Skip',
    iconColor: 'text-rose-400',
    activeBorder: 'hover:border-rose-500/40',
  },
  {
    id: 'ATTENDED',
    icon: CheckCircle,
    label: 'Attend',
    iconColor: 'text-emerald-400',
    activeBorder: 'hover:border-emerald-500/40',
  },
  {
    id: 'GHOST',
    icon: Ghost,
    label: 'Ghost',
    iconColor: 'text-violet-400',
    activeBorder: 'hover:border-violet-500/40',
  },
  {
    id: 'timetable',
    icon: Calendar,
    label: 'Timetable',
    iconColor: 'text-indigo-400',
    activeBorder: 'hover:border-indigo-500/40',
  },
];

export function QuickActionsRow({
  selectedCourse,
  onLogAttendance,
  onOpenTimetable,
}: QuickActionsRowProps) {
  return (
    <div className="grid grid-cols-4 gap-3 px-4 py-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const isLog = action.id !== 'timetable';
        return (
          <button
            key={action.id}
            onClick={() => {
              if (isLog) {
                selectedCourse && onLogAttendance(selectedCourse.id, action.id as LogStatus);
              } else {
                onOpenTimetable();
              }
            }}
            disabled={!selectedCourse && isLog}
            className="flex flex-col items-center gap-2
              active:scale-[0.94] transition-all duration-150
              disabled:opacity-40"
          >
            <div
              className={`w-[52px] h-[52px] rounded-2xl border border-white/10
                bg-[#161b2e]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]
                flex items-center justify-center transition-all ${action.activeBorder}`}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Icon size={22} className={action.iconColor} />
            </div>
            <span className="text-[11px] font-semibold text-slate-300 text-center leading-tight">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
