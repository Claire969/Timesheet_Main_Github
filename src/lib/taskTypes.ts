export type TaskPriority = 'normal' | 'important' | 'urgent' | 'urgent_important';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  client_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  issue_date: string;
  due_date: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  client_id?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  issue_date?: string;
  due_date?: string | null;
  position?: number;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  client_id?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  issue_date?: string;
  due_date?: string | null;
  position?: number;
  completed_at?: string | null;
}

export interface CreateSubtaskPayload {
  task_id: string;
  title: string;
  position?: number;
}

export interface UpdateSubtaskPayload {
  title?: string;
  completed?: boolean;
  completed_at?: string | null;
  position?: number;
}

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent_important: 0,
  urgent: 1,
  important: 2,
  normal: 3,
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent_important: 'Urgent + Important',
  urgent: 'Urgent',
  important: 'Important',
  normal: 'Normal',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  completed: 'Terminé',
};

export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.position - b.position;
  });
}
