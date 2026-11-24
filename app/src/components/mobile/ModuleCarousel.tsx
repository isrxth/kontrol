import { memo } from 'react';
import { Plus, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { CourseStats } from '@/lib/api';

interface ModuleCarouselProps {
  courses: CourseStats[];
  selectedCourseId?: string | null;
  onAddModule: () => void;
  onSelectCourse?: (course: CourseStats) => void;
}

const RISK_DOT: Record<string, string> = {
  SAFE: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
  WARNING: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]',
  DANGER: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
};

const RISK_TEXT: Record<string, string> = {
  SAFE: 'text-emerald-400',
  WARNING: 'text-amber-400',
  DANGER: 'text-rose-400',
};

const RISK_ICON = {
  SAFE: CheckCircle,
  WARNING: AlertTriangle,
  DANGER: ShieldAlert,
};

export const ModuleCarousel = memo(function ModuleCarousel({
  courses,
  selectedCourseId,
  onAddModule,
  onSelectCourse,
}: ModuleCarouselProps) {
  return (
    <div
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 scroll-px-4 pb-3
        scrollbar-none [-webkit-overflow-scrolling:touch]"
    >
      {courses.map((course) => {
        const isSelected = selectedCourseId === course.id;
        const RiskIcon = RISK_ICON[course.riskLevel];

        return (
          <div
            key={course.id}
            onClick={() => {
              onSelectCourse?.(course);
            }}
            className={`snap-start shrink-0 w-[176px] h-[116px] rounded-[20px] p-3.5
              flex flex-col justify-between cursor-pointer select-none
              transition-all duration-200 active:scale-[0.97]
              ${
                isSelected
                  ? 'border border-indigo-400/80 bg-[#1e2544]/90 shadow-[0_0_20px_rgba(99,102,241,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'border border-white/10 bg-[#161b2e]/75 hover:border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
              }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-mono font-bold text-white/90 tabular-nums truncate">
                {course.code}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {isSelected && (
                  <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/25 px-1.5 py-0.5 rounded-full border border-indigo-400/40 leading-none">
                    ACTIVE
                  </span>
                )}
                <RiskIcon size={12} className={RISK_TEXT[course.riskLevel]} />
                <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[course.riskLevel]}`} />
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-end justify-between gap-1">
              <div className="min-w-0 pr-1">
                <p className="text-[12px] font-semibold text-white leading-tight truncate">
                  {course.name}
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                  {course.attendancePercentage}% attended
                </p>
              </div>
              <span
                className={`text-[10px] font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-full whitespace-nowrap ${
                  isSelected
                    ? 'text-indigo-200 bg-indigo-400/20 border border-indigo-400/30'
                    : 'text-white/70 bg-white/10'
                }`}
              >
                {Math.max(0, course.remainingSkips)} left
              </span>
            </div>
          </div>
        );
      })}

      {/* Add module card */}
      <div
        onClick={() => {
          onAddModule();
        }}
        aria-label="Add module"
        className="snap-start shrink-0 w-[84px] h-[116px] rounded-[20px]
          border border-dashed border-white/20 bg-[#161b2e]/40
          flex flex-col items-center justify-center gap-1
          hover:border-white/35 active:scale-[0.97] transition-all duration-150 cursor-pointer"
      >
        <Plus size={20} className="text-white/50" />
        <span className="text-[10px] text-white/50 font-medium">Add</span>
      </div>
    </div>
  );
});
