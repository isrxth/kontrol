import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, GitBranch, Plus, X } from 'lucide-react';
import { PROJECT_COLUMNS } from './vault';
import type { Project, ProjectStatus, ProjectTask } from '@/lib/api';

interface ProjectDetailPanelProps {
  project: Project;
  courses: { id: string; code: string; name: string }[];
  onClose: () => void;
  onStatusChange: (status: ProjectStatus) => void;
  fetchTasks: (projectId: string) => Promise<ProjectTask[]>;
  addTask: (projectId: string, title: string) => Promise<void>;
  updateTask: (taskId: string, input: { title?: string; isDone?: boolean }) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  onEdit: () => void;
  busy: boolean;
}

export function ProjectDetailPanel({
  project,
  onClose,
  onStatusChange,
  fetchTasks,
  addTask,
  updateTask,
  deleteTask,
  onEdit,
  busy,
}: ProjectDetailPanelProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [newTask, setNewTask] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTasks(project.id)
      .then((data) => {
        if (!cancelled) setTasks(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id, fetchTasks]);

  const handleAddTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    setAdding(true);
    try {
      await addTask(project.id, title);
      setTasks(await fetchTasks(project.id));
      setNewTask('');
    } catch {
      // surfaced via controller actionError; keep input intact
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (task: ProjectTask) => {
    await updateTask(task.id, { isDone: !task.isDone });
    setTasks(await fetchTasks(project.id));
  };

  const removeTask = async (taskId: string) => {
    await deleteTask(taskId);
    setTasks(await fetchTasks(project.id));
  };

  const doneCount = tasks.filter((t) => t.isDone).length;

  const content = (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md bg-slate-950/90 border-l border-white/10 shadow-2xl overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-semibold text-indigo-300">
              {project.kind === 'COURSEWORK' ? project.courseCode ?? 'COURSEWORK' : 'PERSONAL BUILD'}
            </p>
            <h3 className="text-xl font-bold text-white mt-1 break-words">{project.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        <div className="grid grid-cols-4 gap-1.5">
          {PROJECT_COLUMNS.map((col) => (
            <button
              key={col.id}
              type="button"
              disabled={busy}
              onClick={() => onStatusChange(col.id)}
              className={`rounded-xl border px-2 py-2 text-[10px] font-semibold transition-all disabled:opacity-50 ${
                project.status === col.id
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>

        {project.description && (
          <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{project.description}</p>
        )}

        {/* Links */}
        {(project.repoUrl || project.liveUrl) && (
          <div className="flex gap-2">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <GitBranch size={13} /> Repository
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
              >
                <ExternalLink size={13} /> Live
              </a>
            )}
          </div>
        )}

        {/* Tech tags */}
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.techStack.map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Tasks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white tracking-wide">Checklist</h4>
            <span className="text-[10px] text-slate-500">
              {doneCount}/{tasks.length} done
            </span>
          </div>

          <div className="space-y-1.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => void toggleTask(task)}
                  aria-label={task.isDone ? 'Mark not done' : 'Mark done'}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-all ${
                    task.isDone
                      ? 'border-emerald-400/60 bg-emerald-500/30 text-emerald-300'
                      : 'border-white/25 hover:border-white/50'
                  }`}
                >
                  {task.isDone && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-xs ${task.isDone ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {task.title}
                </span>
                <button
                  type="button"
                  onClick={() => void removeTask(task.id)}
                  aria-label="Delete task"
                  className="rounded-lg p-1 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="py-3 text-center text-[11px] text-slate-500">No tasks yet — add the first one below.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddTask();
              }}
              placeholder="New task…"
              maxLength={200}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-400/60"
            />
            <button
              type="button"
              disabled={adding || !newTask.trim()}
              onClick={() => void handleAddTask()}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40 transition-all"
              aria-label="Add task"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="w-full rounded-xl border border-white/10 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
        >
          Edit project details
        </button>
      </aside>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
