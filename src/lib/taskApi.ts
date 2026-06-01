import { supabase } from './supabaseClient';
import type {
  Task,
  Subtask,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubtaskPayload,
  UpdateSubtaskPayload,
} from './taskTypes';

const TASKS_TABLE = 'timesheet.tasks';
const SUBTASKS_TABLE = 'timesheet.subtasks';

export const taskApi = {
  async listTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from(TASKS_TABLE)
      .select('*, subtasks:timesheet.subtasks(*)')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Task[];
  },

  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilisateur non authentifié');

    const { count } = await supabase
      .from(TASKS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const position = (count ?? 0);

    const { data, error } = await supabase
      .from(TASKS_TABLE)
      .insert({
        user_id: user.id,
        title: payload.title,
        description: payload.description ?? '',
        client_id: payload.client_id ?? null,
        priority: payload.priority ?? 'normal',
        status: payload.status ?? 'todo',
        issue_date: payload.issue_date ?? new Date().toISOString().slice(0, 10),
        due_date: payload.due_date ?? null,
        position: payload.position ?? position,
      })
      .select()
      .single();

    if (error) throw error;
    return { ...(data as Task), subtasks: [] };
  },

  async updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
    const { data, error } = await supabase
      .from(TASKS_TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from(TASKS_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async completeTask(id: string): Promise<Task> {
    return taskApi.updateTask(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  },

  async reopenTask(id: string): Promise<Task> {
    return taskApi.updateTask(id, {
      status: 'todo',
      completed_at: null,
    });
  },

  // ── Subtasks ────────────────────────────────────────────────────────────────

  async createSubtask(payload: CreateSubtaskPayload): Promise<Subtask> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilisateur non authentifié');

    const { count } = await supabase
      .from(SUBTASKS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('task_id', payload.task_id);

    const { data, error } = await supabase
      .from(SUBTASKS_TABLE)
      .insert({
        task_id: payload.task_id,
        user_id: user.id,
        title: payload.title,
        completed: false,
        position: payload.position ?? (count ?? 0),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Subtask;
  },

  async updateSubtask(id: string, payload: UpdateSubtaskPayload): Promise<Subtask> {
    const { data, error } = await supabase
      .from(SUBTASKS_TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Subtask;
  },

  async toggleSubtask(id: string, completed: boolean): Promise<Subtask> {
    return taskApi.updateSubtask(id, {
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    });
  },

  async deleteSubtask(id: string): Promise<void> {
    const { error } = await supabase
      .from(SUBTASKS_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
