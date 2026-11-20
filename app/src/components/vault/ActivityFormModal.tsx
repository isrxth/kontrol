'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Activity, ActivityPriority, ActivityType, NewActivityInput } from '@/lib/api';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassInput } from '@/components/glassyui/glass-input';

interface ActivityFormModalProps {
  open: boolean;
  onClose: () => void;
  courses: { id: string; code: string; name: string }[];
  initial?: Activity | null;
  busy: boolean;
  onSave: (input: NewActivityInput) => Promise<boolean>;
}

const TYPE_OPTIONS: ActivityType[] = ['EXAM', 'COURSEWORK', 'EVENT', 'OTHER'];
const PRIORITY_OPTIONS: ActivityPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

export function ActivityFormModal({
  open,
  onClose,
  courses,
  initial,
  busy,
  onSave,
}: ActivityFormModalProps) {
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

  useEffect(() => {
    if (!open) return;
    setForm({
      title: initial?.title ?? '',
      type: (initial?.type ?? 'OTHER') as ActivityType,
      courseId: initial?.courseId ?? '',
      dueDate: initial?.dueDate ?? '',
      dueTime: initial?.dueTime ?? '',
      priority: (initial?.priority ?? 'MEDIUM') as ActivityPriority,
      notes: initial?.notes ?? '',
    });
    setFormError(null);
  }, [open, initial]);

  const handleSave = useCallback(async () => {
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
  }, [form, onSave, onClose, busy]);

  const footer = (
    <div className="flex justify-end gap-3 pt-1">
      <GlassButton variant="ghost" size="md" onClick={onClose}>
        Cancel
      </GlassButton>
      <GlassButton variant="primary" size="md" onClick={handleSave} disabled={busy}>
        {busy ? 'Saving…' : initial ? 'Save changes' : 'Add activity'}
      </GlassButton>
    </div>
  );

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      side="bottom"
      title={initial ? 'Edit Activity' : 'New Activity'}
      subtitle="Exams, coursework, events — the planner will remind you later"
      className="w-full sm:w-auto max-h-[85dvh] pointer-events-auto"
      footer={footer}
    >
      <GlassInput
        label="What needs doing?"
        placeholder="…"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
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

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Due date</span>
        <input
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          type="date"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
        />
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Time (optional)</span>
        <input
          value={form.dueTime}
          onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
          type="time"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
        />
      </div>

      <div className="space-y-2">
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

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Link module (optional)</span>
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
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes (syllabus chapters, venue, what to bring…)"
          rows={2}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
        />
      </div>

      {formError && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
          {formError}
        </p>
      )}
    </GlassSheet>
  );
}
