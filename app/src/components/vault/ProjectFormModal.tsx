'use client';

import { useCallback, useEffect, useState } from 'react';
import { PROJECT_COLUMNS } from './vault';
import type { NewProjectInput, Project, ProjectKind, ProjectStatus } from '@/lib/api';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassInput } from '@/components/glassyui/glass-input';

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  courses: { id: string; code: string; name: string }[];
  initial?: Project | null;
  busy: boolean;
  onSave: (input: NewProjectInput) => Promise<unknown>;
}

export function ProjectFormModal({
  open,
  onClose,
  courses,
  initial,
  busy,
  onSave,
}: ProjectFormModalProps) {
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

  useEffect(() => {
    if (!open) return;
    setForm({
      title: initial?.title ?? '',
      kind: (initial?.kind ?? 'PERSONAL') as ProjectKind,
      courseId: initial?.courseId ?? '',
      status: (initial?.status ?? 'IDEA') as ProjectStatus,
      description: initial?.description ?? '',
      repoUrl: initial?.repoUrl ?? '',
      liveUrl: initial?.liveUrl ?? '',
      techStack: initial?.techStack.join(', ') ?? '',
    });
    setFormError(null);
  }, [open, initial]);

  const handleSave = useCallback(async () => {
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
  }, [form, onSave, onClose, busy]);

  const footer = (
    <div className="flex justify-end gap-3 pt-1">
      <GlassButton
        variant="ghost"
        size="md"
        onClick={onClose}
      >
        Cancel
      </GlassButton>
      <GlassButton variant="primary" size="md" onClick={handleSave} disabled={busy}>
        {busy ? 'Saving…' : initial ? 'Save changes' : 'Create project'}
      </GlassButton>
    </div>
  );

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      side="bottom"
      title={initial ? 'Edit Project' : 'New Project'}
      subtitle="Track a build from idea to shipped"
      className="w-full sm:w-auto max-h-[85dvh] pointer-events-auto"
      footer={footer}
    >
      <GlassInput
        label="Project title"
        placeholder="e.g. Senior capstone"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
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

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Description</span>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What is this build about?"
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <GlassInput
          label="Repository URL (optional)"
          placeholder="…"
          value={form.repoUrl}
          onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
        />
        <GlassInput
          label="Live URL (optional)"
          placeholder="…"
          value={form.liveUrl}
          onChange={(e) => setForm({ ...form, liveUrl: e.target.value })}
        />
        <GlassInput
          label="Tech stack, comma separated (e.g. React, FastAPI)"
          placeholder="…"
          value={form.techStack}
          onChange={(e) => setForm({ ...form, techStack: e.target.value })}
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
