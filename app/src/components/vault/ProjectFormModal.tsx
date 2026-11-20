import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PROJECT_COLUMNS } from './vault';
import type { NewProjectInput, Project, ProjectKind, ProjectStatus } from '@/lib/api';

interface ProjectFormModalProps {
  courses: { id: string; code: string; name: string }[];
  initial?: Project | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: NewProjectInput) => Promise<unknown>;
}

export function ProjectFormModal({ courses, initial, busy, onClose, onSave }: ProjectFormModalProps) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    kind: (initial?.kind ?? 'PERSONAL') as ProjectKind,
    courseId: initial?.courseId ?? '',
    status: (initial?.status ?? 'IDEA') as ProjectStatus,
    description: initial?.description ?? '',
    repoUrl: initial?.repoUrl ?? '',
    liveUrl: initial?.liveUrl ?? '',
    techStack: initial?.techStack.join(', ') ?? '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (form.repoUrl && !/^https?:\/\//.test(form.repoUrl.trim())) {
      setFormError('Repository URL must start with http:// or https://');
      return;
    }
    if (form.liveUrl && !/^https?:\/\//.test(form.liveUrl.trim())) {
      setFormError('Live URL must start with http:// or https://');
      return;
    }
    const ok = await onSave({
      title: form.title.trim(),
      kind: form.kind,
      courseId: form.kind === 'COURSEWORK' && form.courseId ? form.courseId : null,
      status: form.status,
      description: form.description.trim() || null,
      repoUrl: form.repoUrl.trim() || null,
      liveUrl: form.liveUrl.trim() || null,
      techStack: form.techStack
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    if (ok) onClose();
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85dvh] sm:max-h-[85vh] flex flex-col rounded-t-[28px] rounded-b-none sm:rounded-3xl border border-b-0 sm:border-b border-white/15 bg-slate-900/98 shadow-2xl mb-0 sm:my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - fixed */}
        <div className="p-5 sm:p-6 pb-3 shrink-0 border-b border-white/[0.06]">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">{initial ? 'Edit Project' : 'New Project'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Track a build from idea to shipped</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Project title"
            maxLength={120}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
          />

          <div className="grid grid-cols-2 gap-2">
            {(['PERSONAL', 'COURSEWORK'] as ProjectKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm({ ...form, kind })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  form.kind === kind
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10'
                }`}
              >
                {kind === 'PERSONAL' ? 'Personal build' : 'Coursework'}
              </button>
            ))}
          </div>

          {form.kind === 'COURSEWORK' && (
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400/60"
            >
              <option value="">Select module…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          )}

          {initial && (
            <div className="grid grid-cols-4 gap-1.5">
              {PROJECT_COLUMNS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setForm({ ...form, status: col.id })}
                  className={`rounded-xl border px-2 py-2 text-[10px] font-semibold transition-all ${
                    form.status === col.id
                      ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this build about?"
            rows={3}
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
          />

          <div className="grid grid-cols-1 gap-3">
            <input
              value={form.repoUrl}
              onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
              placeholder="Repository URL (optional)"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
            />
            <input
              value={form.liveUrl}
              onChange={(e) => setForm({ ...form, liveUrl: e.target.value })}
              placeholder="Live URL (optional)"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
            />
            <input
              value={form.techStack}
              onChange={(e) => setForm({ ...form, techStack: e.target.value })}
              placeholder="Tech stack, comma separated (e.g. React, FastAPI)"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
            />
          </div>

          {formError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{formError}</p>
          )}
        </div>

        {/* Footer Actions - fixed with safe-area bottom */}
        <div className="p-4 sm:p-5 shrink-0 border-t border-white/[0.08] bg-slate-900/98 pb-[calc(var(--sab,env(safe-area-inset-bottom,0px))+16px)] sm:pb-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
          >
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
