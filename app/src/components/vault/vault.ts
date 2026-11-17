import type { Activity, Project, ProjectStatus } from '@/lib/api';

export const PROJECT_COLUMNS: { id: ProjectStatus; label: string }[] = [
  { id: 'IDEA', label: 'Idea' },
  { id: 'BUILDING', label: 'Building' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'PAUSED', label: 'Paused' },
];

export function dragIdForProject(projectId: string): string {
  return `project:${projectId}`;
}

export function parseDragId(id: string): { kind: 'project'; projectId: string } | null {
  const [kind, projectId] = id.split(':');
  if (kind === 'project' && projectId) return { kind: 'project', projectId };
  return null;
}

export function columnDroppableId(status: ProjectStatus): string {
  return `col:${status}`;
}

export function cardDroppableId(projectId: string): string {
  return `card:${projectId}`;
}

export function parseDroppableId(
  id: string,
): { kind: 'column'; status: ProjectStatus } | { kind: 'card'; projectId: string } | null {
  const [kind, value] = id.split(':');
  if (kind === 'col' && value) {
    const status = value as ProjectStatus;
    if (PROJECT_COLUMNS.some((c) => c.id === status)) return { kind: 'column', status };
  }
  if (kind === 'card' && value) return { kind: 'card', projectId: value };
  return null;
}

export function projectsInColumn(projects: Project[], status: ProjectStatus): Project[] {
  return projects.filter((p) => p.status === status);
}

export interface ProjectDragPreview {
  title: string;
  code: string | null;
}

export type ActivityBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'NO_DATE' | 'DONE';

export function bucketOf(activity: Activity, today: string): ActivityBucket {
  if (activity.isDone) return 'DONE';
  if (!activity.dueDate) return 'NO_DATE';
  if (activity.dueDate < today) return 'OVERDUE';
  if (activity.dueDate === today) return 'TODAY';
  return 'UPCOMING';
}
