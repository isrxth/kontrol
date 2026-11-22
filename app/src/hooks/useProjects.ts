import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type NewProjectInput,
  type Project,
  type ProjectStatus,
  type ProjectTask,
} from '@/lib/api';
import { CACHE_KEYS, getCached } from '@/lib/offline-store';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(
    () => getCached<Project[]>(CACHE_KEYS.projects) ?? []
  );
  const [loading, setLoading] = useState(
    () => !getCached<Project[]>(CACHE_KEYS.projects)
  );
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    setProjects(await api.getProjects());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await api.getProjects();
        if (!cancelled) {
          setProjects(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionError(null);
      setBusy(true);
      try {
        await action();
        await refetch();
        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Action failed');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refetch],
  );

  const createProject = useCallback(
    (input: NewProjectInput) => runAction(() => api.createProject(input)),
    [runAction],
  );

  const updateProject = useCallback(
    (id: string, input: Partial<NewProjectInput>) =>
      runAction(() => api.updateProject(id, input)),
    [runAction],
  );

  /** Sets one project's status and renumbers the whole target column. */
  const moveProject = useCallback(
    (project: Project, targetStatus: ProjectStatus, targetOrderedIds: string[]) => {
      const ids = targetOrderedIds.includes(project.id)
        ? targetOrderedIds
        : [...targetOrderedIds, project.id];
      return runAction(() => api.reorderProjects(targetStatus, ids));
    },
    [runAction],
  );

  const reorderProjects = useCallback(
    (status: ProjectStatus, orderedIds: string[]) =>
      runAction(() => api.reorderProjects(status, orderedIds)),
    [runAction],
  );

  const deleteProject = useCallback(
    (id: string) => runAction(() => api.deleteProject(id)),
    [runAction],
  );

  /** Full task list lives in the detail panel; cards only show counts from GET /projects. */
  const fetchTasks = useCallback(
    (projectId: string) => api.getProjectTasks(projectId) as Promise<ProjectTask[]>,
    [],
  );

  const addTask = useCallback(
    async (projectId: string, title: string) => {
      await api.addProjectTask(projectId, title);
      await refetch();
    },
    [refetch],
  );

  const updateTask = useCallback(
    async (taskId: string, input: { title?: string; isDone?: boolean }) => {
      await api.updateProjectTask(taskId, input);
      await refetch();
    },
    [refetch],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await api.deleteProjectTask(taskId);
      await refetch();
    },
    [refetch],
  );

  return {
    projects,
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    busy,
    refetch,
    createProject,
    updateProject,
    moveProject,
    reorderProjects,
    deleteProject,
    fetchTasks,
    addTask,
    updateTask,
    deleteTask,
  };
}

export type ProjectsController = ReturnType<typeof useProjects>;
