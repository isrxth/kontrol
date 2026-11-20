import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDndSensors } from '@/hooks/useDndSensors';
import { KanbanSquare, Plus, RefreshCw } from 'lucide-react';
import type { CourseStats, Project, ProjectStatus } from '@/lib/api';
import type { ProjectsController } from '@/hooks/useProjects';
import type { ActivitiesController } from '@/hooks/useActivities';
import {
  PROJECT_COLUMNS,
  columnDroppableId,
  parseDragId,
  parseDroppableId,
  projectsInColumn,
  type ProjectDragPreview,
} from './vault';
import { ProjectCard } from './ProjectCard';
import { ProjectDetailPanel } from './ProjectDetailPanel';
import { ProjectFormModal } from './ProjectFormModal';
import { ActivitiesAgenda } from './ActivitiesAgenda';

interface BuildVaultProps {
  projectsCtrl: ProjectsController;
  activitiesCtrl: ActivitiesController;
  courses: CourseStats[];
}

interface KanbanBoardProps {
  ctrl: ProjectsController;
  courses: CourseStats[];
}

interface KanbanBoardProps {
  ctrl: ProjectsController;
}

export function BuildVault({ projectsCtrl, activitiesCtrl, courses }: BuildVaultProps) {
  const [formTarget, setFormTarget] = useState<'new' | Project | null>(null);
  const busy = projectsCtrl.busy;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KanbanSquare size={14} className="text-indigo-300" />
            <h3 className="text-sm font-bold text-white tracking-wide">Projects</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void projectsCtrl.refetch()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all"
            >
              <Plus size={12} /> New Project
            </button>
          </div>
        </div>

        {projectsCtrl.actionError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <span>{projectsCtrl.actionError}</span>
            <button type="button" onClick={projectsCtrl.clearActionError} className="shrink-0 text-rose-200 hover:text-white">
              ✕
            </button>
          </div>
        )}

        <KanbanBoard ctrl={projectsCtrl} courses={courses} setFormTarget={setFormTarget} />
      </section>

      <ActivitiesAgenda ctrl={activitiesCtrl} courses={courses} />

      {formTarget && (
        <ProjectFormModal
          courses={courses}
          initial={formTarget === 'new' ? null : formTarget}
          busy={busy}
          onClose={() => setFormTarget(null)}
          onSave={async (input) =>
            formTarget === 'new'
              ? projectsCtrl.createProject(input)
              : projectsCtrl.updateProject(formTarget.id, input)
          }
        />
      )}
    </div>
  );
}

interface KanbanBoardProps {
  ctrl: ProjectsController;
  courses: CourseStats[];
  setFormTarget: (target: 'new' | Project | null) => void;
}

function KanbanBoard({ ctrl, courses, setFormTarget }: KanbanBoardProps) {
  const { projects, loading, error } = ctrl;

  const sensors = useDndSensors();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<ProjectDragPreview | null>(null);

  const detailProject = projects.find((p) => p.id === detailId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    const payload = parseDragId(String(event.active.id));
    if (!payload) return;
    const project = projects.find((p) => p.id === payload.projectId);
    if (project) {
      setDragPreview({ title: project.title, code: project.kind === 'COURSEWORK' ? project.courseCode ?? 'CW' : 'Personal' });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragPreview(null);
    setOpenMenu(null);

    const payload = parseDragId(String(event.active.id));
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!payload || !overId) return;
    const project = projects.find((p) => p.id === payload.projectId);
    if (!project) return;

    const over = parseDroppableId(overId);
    if (!over) return;

    if (over.kind === 'column') {
      if (over.status === project.status) return;
      const columnIds = projectsInColumn(projects, over.status).map((p) => p.id);
      void ctrl.moveProject(project, over.status, columnIds);
      return;
    }

    // Dropped on a card: insert before it in that card's column.
    const overProject = projects.find((p) => p.id === over.projectId);
    if (!overProject) return;
    if (overProject.id === project.id) return;

    const columnIds = projectsInColumn(projects, overProject.status).map((p) => p.id);
    const insertAt = columnIds.indexOf(overProject.id);
    const sameColumn = project.status === overProject.status;
    const withoutSelf = sameColumn ? columnIds.filter((id) => id !== project.id) : columnIds;
    const adjust = sameColumn && columnIds.indexOf(project.id) < insertAt ? 1 : 0;
    const orderedIds = [...withoutSelf.slice(0, insertAt - adjust), project.id, ...withoutSelf.slice(insertAt - adjust)];
    void ctrl.moveProject(project, overProject.status, orderedIds);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/15 bg-slate-900/40 p-12 text-center">
        <p className="text-sm text-slate-400">Loading projects…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-slate-900/40 p-12 text-center">
        <h3 className="text-xl font-bold text-white">API Offline</h3>
        <p className="mt-2 text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragPreview(null)}
    >
      <div className="grid gap-3 md:grid-cols-4">
        {PROJECT_COLUMNS.map((col) => {
          const columnProjects = projectsInColumn(projects, col.id);
          return <KanbanColumn key={col.id} status={col.id} label={col.label} projects={columnProjects} ctrl={ctrl} openMenu={openMenu} setOpenMenu={setOpenMenu} setDetailId={setDetailId} setFormTarget={setFormTarget} />;
        })}
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {dragPreview && (
            <div className="w-64 rounded-2xl border border-indigo-400/50 bg-[#161b2e]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md scale-[1.03] select-none">
              <span className="text-[9px] font-mono font-semibold text-indigo-300">{dragPreview.code}</span>
              <p className="text-xs font-bold text-white truncate">{dragPreview.title}</p>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}

      {detailProject && (
        <ProjectDetailPanel
          project={detailProject}
          courses={courses}
          busy={ctrl.busy}
          onClose={() => setDetailId(null)}
          onStatusChange={(status) => void ctrl.updateProject(detailProject.id, { status })}
          fetchTasks={ctrl.fetchTasks}
          addTask={ctrl.addTask}
          updateTask={ctrl.updateTask}
          deleteTask={ctrl.deleteTask}
          onEdit={() => {
            setFormTarget(detailProject);
            setDetailId(null);
          }}
        />
      )}
    </DndContext>
  );
}

interface KanbanColumnProps {
  status: ProjectStatus;
  label: string;
  projects: Project[];
  ctrl: ProjectsController;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  setDetailId: (id: string) => void;
  setFormTarget: (target: 'new' | Project) => void;
}

function KanbanColumn({ status, label, projects, ctrl, openMenu, setOpenMenu, setDetailId, setFormTarget }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(status) });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 space-y-2 rounded-3xl border p-2.5 transition-all ${
        isOver ? 'border-indigo-400/50 bg-indigo-500/5' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-2 px-1.5 pb-1">
        <span className={`h-1.5 w-1.5 rounded-full ${status === 'BUILDING' ? 'bg-indigo-400' : status === 'SHIPPED' ? 'bg-emerald-400' : status === 'PAUSED' ? 'bg-amber-400' : 'bg-slate-400'}`} />
        <h4 className="text-xs font-bold text-slate-300">{label}</h4>
        <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{projects.length}</span>
      </div>

      <div className="space-y-2 min-h-16">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            menuOpen={openMenu === project.id}
            onToggleMenu={() => setOpenMenu(openMenu === project.id ? null : project.id)}
            onCloseMenu={() => setOpenMenu(null)}
            onOpenDetail={() => setDetailId(project.id)}
            onEdit={() => setFormTarget(project)}
            onDelete={() => void ctrl.deleteProject(project.id)}
          />
        ))}
        {projects.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded-2xl border border-dashed border-white/10 text-[10px] text-slate-600">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
