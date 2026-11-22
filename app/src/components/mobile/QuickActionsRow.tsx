import { memo } from 'react';
import { ShieldCheck, CheckCircle, Calendar, Ghost } from 'lucide-react';
import type { CourseStats, LogStatus } from '@/lib/api';
import { hapticAction, hapticTap, hapticWarning } from '@/lib/haptics';

interface QuickActionsRowProps {
  selectedCourse: CourseStats | null;
  onLogAttendance: (courseId: string, status: LogStatus) => void;
  onOpenTimetable: () => void;
  onAddTask?: () => void;
}

export const QuickActionsRow = memo(function QuickActionsRow({
  selectedCourse,
  onLogAttendance,
  onOpenTimetable,
}: QuickActionsRowProps) {
  const actions = [
    {
      icon: ShieldCheck,
      label: 'Log Skip',
      iconColor: 'text-rose-400',
      activeBorder: 'hover:border-rose-500/40',
      onClick: () => {
        if (!selectedCourse) return;
        if (selectedCourse.remainingSkips <= 1) {
          void hapticWarning();
        } else {
          void hapticAction();
        }
        onLogAttendance(selectedCourse.id, 'SKIPPED');
      },
      disabled: !selectedCourse,
    },
    {
      icon: CheckCircle,
      label: 'Attended',
      iconColor: 'text-emerald-400',
      activeBorder: 'hover:border-emerald-500/40',
      onClick: () => {
        if (!selectedCourse) return;
        void hapticAction();
        onLogAttendance(selectedCourse.id, 'ATTENDED');
      },
      disabled: !selectedCourse,
    },
    {
      icon: Ghost,
      label: 'Ghost',
      iconColor: 'text-violet-400',
      activeBorder: 'hover:border-violet-500/40',
      onClick: () => {
        if (!selectedCourse) return;
        void hapticAction();
        onLogAttendance(selectedCourse.id, 'GHOST');
      },
      disabled: !selectedCourse,
    },
    {
      icon: Calendar,
      label: 'Timetable',
      iconColor: 'text-indigo-400',
      activeBorder: 'hover:border-indigo-500/40',
      onClick: () => {
        void hapticTap();
        onOpenTimetable();
      },
      disabled: false,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 px-4 py-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
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
});
