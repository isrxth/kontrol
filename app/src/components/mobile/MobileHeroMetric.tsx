import { ChevronRight } from 'lucide-react';
import type { CourseStats } from '@/lib/api';

interface MobileHeroMetricProps {
  courses: CourseStats[];
}

export function MobileHeroMetric({ courses }: MobileHeroMetricProps) {
  if (courses.length === 0) return null;

  const safeModules  = courses.filter((c) => c.riskLevel !== 'DANGER').length;
  const totalModules = courses.length;
  const totalSkipsLeft = courses.reduce(
    (sum, c) => sum + Math.max(0, c.remainingSkips),
    0,
  );
  const overallPct = courses.length > 0
    ? Math.round(
        courses.reduce((sum, c) => sum + c.attendancePercentage, 0) / courses.length,
      )
    : 100;

  return (
    <div className="px-4 pb-4">
      <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
        Overall Eligibility
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-[52px] font-black text-white tabular-nums leading-none">
          {overallPct}%
        </span>
        <ChevronRight size={20} className="text-slate-500 mb-1 shrink-0" />
      </div>
      <p className="text-[12px] text-slate-500 mt-1 tabular-nums">
        {safeModules}/{totalModules} modules eligible
        {totalSkipsLeft > 0 && ` · ${totalSkipsLeft} skips remaining`}
      </p>
    </div>
  );
}
