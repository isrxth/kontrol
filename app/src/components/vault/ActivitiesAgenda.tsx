import { useMemo, useState } from 'react';
import { CalendarClock, Check, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Activity, ActivityType, CourseStats } from '@/lib/api';
import type { ActivitiesController } from '@/hooks/useActivities';
import { todayLocal } from '@/lib/timetable';
import { ActivityFormModal } from './ActivityFormModal';
import { bucketOf, type ActivityBucket } from './vault';

interface ActivitiesAgendaProps {
  ctrl: ActivitiesController;
  courses: CourseStats[];
}

const TYPE_STYLES: Record<ActivityType, string> = {
  EXAM: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
  COURSEWORK: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  EVENT: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300',
  OTHER: 'border-white/15 bg-white/5 text-slate-300',
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-rose-400',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-slate-500',
};

export function ActivitiesAgenda({ ctrl, courses }: ActivitiesAgendaProps) {
  const { activities, loading, error } = ctrl;
  const [formTarget, setFormTarget] = useState<'new' | Activity | null>(null);
  const [showDone, setShowDone] = useState(false);

  const buckets = useMemo(() => {
    const today = todayLocal();
    const grouped: Record<ActivityBucket, Activity[]> = {
      OVERDUE: [], TODAY: [], UPCOMING: [], NO_DATE: [], DONE: [],
    };
    for (const activity of activities) {
      grouped[bucketOf(activity, today)].push(activity);
    }
    return grouped;
  }, [activities]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/15 bg-slate-900/40 p-10 text-center">
        <p className="text-sm text-slate-400">Loading activities…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-slate-900/40 p-10 text-center">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  const sections: { key: ActivityBucket; label: string; accent: string; activities: Activity[] }[] = [
    { key: 'OVERDUE', label: 'Overdue', accent: 'text-rose-300', activities: buckets.OVERDUE },
    { key: 'TODAY', label: 'Today', accent: 'text-indigo-300', activities: buckets.TODAY },
    { key: 'UPCOMING', label: 'Upcoming', accent: 'text-slate-300', activities: buckets.UPCOMING },
    { key: 'NO_DATE', label: 'No date', accent: 'text-slate-400', activities: buckets.NO_DATE },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className="text-indigo-300" />
          <h3 className="text-sm font-bold text-white tracking-wide">Activities</h3>
          <span className="text-[10px] text-slate-500">exams · coursework · events</span>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget('new')}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all"
        >
          <Plus size={12} /> Add Activity
        </button>
      </div>

      {ctrl.actionError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <span>{ctrl.actionError}</span>
          <button type="button" onClick={ctrl.clearActionError} className="shrink-0 text-rose-200 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {activities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-slate-400">No activities yet.</p>
          <p className="text-xs text-slate-500 mt-1">Add exams, coursework deadlines and events so nothing slips.</p>
        </div>
      )}

      <div className="space-y-5">
        {sections.map((section) =>
          section.activities.length === 0 ? null : (
            <div key={section.key} className="space-y-2">
              <h4 className={`px-1 text-[11px] font-bold uppercase tracking-widest ${section.accent}`}>
                {section.label}
                <span className="ml-1.5 text-slate-500">{section.activities.length}</span>
              </h4>
              <div className="space-y-1.5">
                {section.activities.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    onToggleDone={() => void ctrl.updateActivity(activity.id, { isDone: !activity.isDone })}
                    onEdit={() => setFormTarget(activity)}
                    onDelete={() => void ctrl.deleteActivity(activity.id)}
                  />
                ))}
              </div>
            </div>
          ),
        )}

        {buckets.DONE.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              className="px-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-all"
            >
              Done
              <span className="ml-1.5">{buckets.DONE.length}</span>
              <span className="ml-1.5 normal-case text-[10px] text-slate-600">{showDone ? 'hide' : 'show'}</span>
            </button>
            {showDone && (
              <div className="space-y-1.5">
                {buckets.DONE.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    dimmed
                    onToggleDone={() => void ctrl.updateActivity(activity.id, { isDone: false })}
                    onEdit={() => setFormTarget(activity)}
                    onDelete={() => void ctrl.deleteActivity(activity.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {formTarget && (
        <ActivityFormModal
          courses={courses}
          initial={formTarget === 'new' ? null : formTarget}
          busy={ctrl.busy}
          onClose={() => setFormTarget(null)}
          onSave={async (input) => {
            if (formTarget === 'new') {
              await ctrl.createActivity(input);
            } else {
              await ctrl.updateActivity(formTarget.id, input);
            }
            return true;
          }}
        />
      )}
    </section>
  );
}

interface ActivityRowProps {
  activity: Activity;
  dimmed?: boolean;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ActivityRow({ activity, dimmed = false, onToggleDone, onEdit, onDelete }: ActivityRowProps) {
  const today = todayLocal();
  const dateLabel = activity.dueDate
    ? `${new Date(`${activity.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${activity.dueTime ? ` · ${activity.dueTime}` : ' · all-day'}`
    : null;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`draggable-item group flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-all select-none ${
        dimmed ? 'border-white/5 bg-white/[0.015] opacity-50' : 'border-white/10 bg-slate-900/50 hover:border-white/20'
      }`}
    >
      <span className="drag-handle touch-none shrink-0 p-0.5 text-slate-600 hover:text-slate-400 cursor-grab">
        <GripVertical size={13} />
      </span>

      <button
        type="button"
        onClick={onToggleDone}
        aria-label={activity.isDone ? 'Mark not done' : 'Mark done'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
          activity.isDone
            ? 'border-emerald-400/60 bg-emerald-500/30 text-emerald-300'
            : 'border-white/25 hover:border-emerald-400/60'
        }`}
      >
        {activity.isDone && <Check size={11} />}
      </button>

      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${TYPE_STYLES[activity.type]}`}>
        {activity.type}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${activity.isDone ? 'text-slate-500 line-through' : 'text-white'}`}>
          {activity.title}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {activity.courseCode && <span className="font-mono text-indigo-300/80">{activity.courseCode}</span>}
          {dateLabel && (
            <span className={bucketOf(activity, today) === 'OVERDUE' ? 'text-rose-400 font-semibold' : ''}>
              {dateLabel}
            </span>
          )}
          {activity.notes && <span className="truncate max-w-40">{activity.notes}</span>}
        </div>
      </div>

      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[activity.priority]}`} />

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button type="button" onClick={onEdit} aria-label="Edit" className="rounded-lg p-1.5 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/10 transition-all">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
