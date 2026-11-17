import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ExternalLink, GitBranch, ListChecks, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Project } from '@/lib/api';
import { cardDroppableId, dragIdForProject } from './vault';

interface ProjectCardProps {
  project: Project;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, menuOpen, onToggleMenu, onCloseMenu, onOpenDetail, onEdit, onDelete }: ProjectCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragIdForProject(project.id),
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardDroppableId(project.id),
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen, onCloseMenu]);

  return (
    <div ref={setDropRef}>
      {isOver && (
        <div className="mb-2 h-0.5 rounded-full bg-indigo-400/80" />
      )}
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onDoubleClick={onOpenDetail}
        className={`relative rounded-2xl border border-white/10 bg-slate-900/70 p-3 transition-all cursor-grab active:cursor-grabbing select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 hover:border-white/20 ${
          isDragging ? 'opacity-30' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpenDetail} className="min-w-0 text-left">
            <p className="text-sm font-bold text-white truncate">{project.title}</p>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {project.kind === 'COURSEWORK' ? (
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
                  {project.courseCode ?? 'Coursework'}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                  Personal
                </span>
              )}
              {project.techStack.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            aria-label="Project options"
            className={`shrink-0 rounded-lg p-1 text-slate-500 hover:text-white hover:bg-white/10 transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${menuOpen ? 'text-white bg-white/10' : ''}`}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <ListChecks size={11} />
            {project.doneTaskCount}/{project.totalTaskCount}
          </span>
          <span className="flex items-center gap-1">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded-lg p-1 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Repository"
              >
                <GitBranch size={12} />
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded-lg p-1 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Live site"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </span>
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-1 top-8 z-50 w-40 rounded-2xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={onEdit}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <Pencil size={12} className="text-blue-400" /> Edit project
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <Trash2 size={12} className="text-rose-400" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
