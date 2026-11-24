import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type NewProjectInput,
  type Project,
  type ProjectStatus,
  type ProjectTask,
} from '@/lib/api';
import { CACHE_KEYS, getCached, setCached } from '@/lib/offline-store';

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
    const data = await api.getProjects();
    setProjects(data);
    setCached(CACHE_KEYS.projects, data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await api.getProjects();
        if (!cancelled) {
          setProjects(data);
          setCached(CACHE_KEYS.projects, data);
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

  /** Optimistic mutation helper for projects. */
  const runOptimistic = useCallback(
    async (mutator: () => void, action: () => Promise<unknown>) => {
      const prev = [...projects];
      setBusy(true);
      mutator();
      setCached(CACHE_KEYS.projects, [...projects]);
      try {
        await action();
        void refetch();
      } catch (err) {
        setProjects(prev);
        setCached(CACHE_KEYS.projects, prev);
        setActionError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [projects, refetch]
  );

  const createProject = useCallback(
    (input: NewProjectInput) => {
      const tempId = `opt_proj_${Date.now()}`;
      const optimistic: Project = {
        id: tempId,
        title: input.title,
        kind: input.kind ?? 'PERSONAL',
        courseId: input.courseId ?? null,
        courseCode: null,
        status: input.status ?? 'IDEA',
        description: input.description ?? null,
        repoUrl: input.repoUrl ?? null,
        liveUrl: input.liveUrl ?? null,
        techStack: input.techStack ?? [],
        position: projects.length,
        doneTaskCount: 0,
        totalTaskCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      void runOptimistic(
        () => {
          setProjects([...projects, optimistic]);
        },
        () => api.createProject(input)
      );
    },
    [projects, runOptimistic]
  );

  const updateProject = useCallback(
    (id: string, input: Partial<NewProjectInput>) => {
      void runOptimistic(
        () => {
          setProjects(projects.map((p) => (p.id === id ? { ...p, ...input, techStack: input.techStack ?? p.techStack, updatedAt: new Date().toISOString() } : p)));
        },
        () => api.updateProject(id, input)
      );
    },
    [projects, runOptimistic]
  );

  /** Sets one project's status and renumbers the whole target column. */
  const moveProject = useCallback(
    (project: Project, targetStatus: ProjectStatus, targetOrderedIds: string[]) => {
      const ids = targetOrderedIds.includes(project.id)
        ? targetOrderedIds
        : [...targetOrderedIds, project.id];
      void runOptimistic(
        () => {
          // Optimistic reorder handled server-side; keep local order stable.
        },
        () => api.reorderProjects(targetStatus, ids)
      );
    },
    [projects, runOptimistic]
  );

  const reorderProjects = useCallback(
    (status: ProjectStatus, orderedIds: string[]) => {
      const idSet = new Set(orderedIds);
      const next = [
        ...projects.filter((p) => p.status === status && idSet.has(p.id)).sort(
          (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)
        ),
        ...projects.filter((p) => p.status !== status || !idSet.has(p.id)),
      ];
      void runOptimistic(
        () => setProjects(next),
        () => api.reorderProjects(status, orderedIds)
      );
    },
    [projects, runOptimistic]
  );

  const deleteProject = useCallback(
    (id: string) => {
      void runOptimistic(
        () => {
          setProjects(projects.filter((p) => p.id !== id));
        },
        () => api.deleteProject(id)
      );
    },
    [projects, runOptimistic]
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
