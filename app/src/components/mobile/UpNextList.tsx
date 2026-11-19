import { BookOpen, Zap, CalendarCheck, Star } from 'lucide-react';
import type { Activity, ActivityType } from '@/lib/api';

interface UpNextListProps {
  activities: Activity[];
  onViewAll?: () => void;
}

function ActivityIcon({ type }: { type: ActivityType }) {
  switch (type) {
    case 'EXAM':       return <BookOpen size={16} className="text-rose-400" />;
    case 'COURSEWORK': return <CalendarCheck size={16} className="text-indigo-400" />;
    case 'EVENT':      return <Star size={16} className="text-amber-400" />;
    default:           return <Zap size={16} className="text-slate-400" />;
  }
}

const PRIORITY_PILL: Record<string, string> = {
  HIGH:   'bg-rose-500/20 text-rose-400',
  MEDIUM: 'bg-amber-500/15 text-amber-400',
  LOW:    'bg-white/10 text-slate-400',
};

const TYPE_BG: Record<ActivityType, string> = {
  EXAM:       'bg-rose-500/15',
  COURSEWORK: 'bg-indigo-500/15',
  EVENT:      'bg-amber-500/15',
  OTHER:      'bg-white/[0.07]',
};

export function UpNextList({ activities, onViewAll }: UpNextListProps) {
  const upcoming = activities
    .filter((a) => !a.isDone)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 5);

  return (
    <div className="mx-4 mt-3 rounded-[24px] bg-[#161b2e]/75 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold text-white">Up Next</span>
        <button
          onClick={onViewAll}
          className="text-[11px] text-indigo-400 font-semibold
            px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/20
            active:scale-95 transition-transform duration-150"
        >
          All
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-[12px] text-slate-500 py-2 text-center">
          No upcoming tasks — add some in Build Vault
        </p>
      ) : (
        <div className="space-y-0">
          {upcoming.map((act, i) => (
            <div
              key={act.id}
              className={`flex items-center gap-3 py-2.5
                ${i < upcoming.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
            >
              {/* Left squircle icon */}
              <div
                className={`w-10 h-10 rounded-[14px] shrink-0 flex items-center justify-center ${TYPE_BG[act.type]}`}
                style={{ minWidth: 40, minHeight: 40 }}
              >
                <ActivityIcon type={act.type} />
              </div>
              {/* Middle */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{act.title}</p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {act.courseCode ?? 'Personal'}
                  {act.dueDate ? ` · ${act.dueDate}` : ''}
                </p>
              </div>
              {/* Right pill */}
              <span
                className={`text-[10px] font-bold tabular-nums shrink-0
                  px-2 py-0.5 rounded-full ${PRIORITY_PILL[act.priority]}`}
              >
                {act.priority}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
