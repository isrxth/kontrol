import { Clock, ChevronRight } from 'lucide-react';
import type { TodaySlot } from '@/lib/api';

interface NextLectureBannerProps {
  next: TodaySlot | null;
  onPress?: () => void;
}

export function NextLectureBanner({ next, onPress }: NextLectureBannerProps) {
  return (
    <button
      className="w-full mx-0 rounded-[20px] bg-[#161b2e]/75 border border-white/10
        shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]
        px-4 py-3.5 flex items-center gap-3
        active:scale-[0.98] transition-all duration-150 text-left"
      onClick={onPress}
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/20
        flex items-center justify-center shrink-0">
        <Clock size={16} className="text-indigo-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
          Next Lecture
        </p>
        {next ? (
          <>
            <p className="text-[13px] font-bold text-white truncate mt-0.5">
              {next.course.name}
            </p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              {next.startTime}{next.venue ? ` · ${next.venue}` : ''}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-slate-500 mt-0.5">No more classes today</p>
        )}
      </div>
      <ChevronRight size={16} className="text-slate-500 shrink-0" />
    </button>
  );
}
