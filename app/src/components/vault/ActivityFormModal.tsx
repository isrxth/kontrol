import { useState } from 'react';
import { X } from 'lucide-react';
import type { Activity, ActivityPriority, ActivityType, NewActivityInput } from '@/lib/api';

interface ActivityFormModalProps {
  courses: { id: string; code: string; name: string }[];
  initial?: Activity | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: NewActivityInput) => Promise<boolean>;
}

const TYPE_OPTIONS: ActivityType[] = ['EXAM', 'COURSEWORK', 'EVENT', 'OTHER'];
const PRIORITY_OPTIONS: ActivityPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export function ActivityFormModal({ courses, initial, busy, onClose, onSave }: ActivityFormModalProps) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    type: (initial?.type ?? 'OTHER') as ActivityType,
    courseId: initial?.courseId ?? '',
    dueDate: initial?.dueDate ?? '',
    dueTime: initial?.dueTime ?? '',
    priority: (initial?.priority ?? 'MEDIUM') as ActivityPriority,
    notes: initial?.notes ?? '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    const ok = await onSave({
      title: form.title.trim(),
      type: form.type,
      courseId: form.courseId || null,
      dueDate: form.dueDate || null,
      dueTime: form.dueTime || null,
      priority: form.priority,
      notes: form.notes.trim() || null,
    });
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-slate-900/90 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">{initial ? 'Edit Activity' : 'New Activity'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Exams, coursework, events — the planner will remind you later</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What needs doing?"
          maxLength={200}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
        />

        <div className="grid grid-cols-4 gap-1.5">
          {TYPE_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm({ ...form, type })}
              className={`rounded-xl border px-2 py-2 text-[10px] font-semibold transition-all ${
                form.type === type
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Due date</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400/60 [color-scheme:dark]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Time (optional)</span>
            <input
              type="time"
              value={form.dueTime}
              onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400/60 [color-scheme:dark]"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Priority</span>
          <div className="grid grid-cols-3 gap-1.5">
            {PRIORITY_OPTIONS.map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() => setForm({ ...form, priority })}
                className={`rounded-xl border px-2 py-2 text-[10px] font-semibold transition-all ${
                  form.priority === priority
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        <select
          value={form.courseId}
          onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
        >
          <option value="">Link a module (optional)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>

        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes (syllabus chapters, venue, what to bring…)"
          rows={2}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
        />

        {formError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{formError}</p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all"
          >
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add activity'}
          </button>
        </div>
      </div>
    </div>
  );
}
