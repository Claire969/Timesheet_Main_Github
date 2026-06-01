import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, Check,
  AlertCircle, Star, Info, ArrowUpDown, Calendar, X,
  RotateCcw, ChevronRight,
} from 'lucide-react';
import { AppNav } from '../components/AppNav';
import { useLoadClients } from '../lib/useLoadClients';
import { useAppState } from '../App';
import { taskApi } from '../lib/taskApi';
import { supabaseEnabled } from '../lib/supabaseClient';
import type { Task, Subtask, TaskPriority, TaskStatus, CreateTaskPayload, UpdateTaskPayload } from '../lib/taskTypes';
import {
  PRIORITY_LABELS, STATUS_LABELS, PRIORITY_ORDER, sortTasksByPriority,
} from '../lib/taskTypes';

// ─── Priority / Status config ────────────────────────────────────────────────

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  urgent_important: 'bg-red-100 text-red-700 border border-red-200',
  urgent: 'bg-red-50 text-red-600 border border-red-200',
  important: 'bg-orange-50 text-orange-600 border border-orange-200',
  normal: 'bg-blue-50 text-blue-600 border border-blue-200',
};

const PRIORITY_ROW: Record<TaskPriority, string> = {
  urgent_important: 'border-l-4 border-l-red-500',
  urgent: 'border-l-4 border-l-red-400',
  important: 'border-l-4 border-l-orange-400',
  normal: 'border-l-4 border-l-blue-300',
};

const PRIORITY_ICON: Record<TaskPriority, React.ReactNode> = {
  urgent_important: <AlertCircle size={13} className="text-red-500" />,
  urgent: <AlertCircle size={13} className="text-red-400" />,
  important: <Star size={13} className="text-orange-400" />,
  normal: <Info size={13} className="text-blue-400" />,
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('fr-BE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return d; }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return due < today();
}

// ─── Task form (create / edit) ───────────────────────────────────────────────

interface TaskFormData {
  title: string;
  description: string;
  client_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  issue_date: string;
  due_date: string;
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  client_id: '',
  priority: 'normal',
  status: 'todo',
  issue_date: today(),
  due_date: '',
};

interface TaskFormProps {
  initial?: TaskFormData;
  clients: { id: string; name: string }[];
  onSave: (data: TaskFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function TaskForm({ initial, clients, onSave, onCancel, saving }: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>(initial ?? EMPTY_FORM);

  const set = <K extends keyof TaskFormData>(k: K, v: TaskFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Titre *</label>
          <input
            autoFocus
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Titre de la tâche"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
          <select
            value={form.client_id}
            onChange={e => set('client_id', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Sans client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium text-gray-500 mb-1">Priorité</label>
          <select
            value={form.priority}
            onChange={e => set('priority', e.target.value as TaskPriority)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(p => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
          <select
            value={form.status}
            onChange={e => set('status', e.target.value as TaskStatus)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Date émission</label>
          <input
            type="date"
            value={form.issue_date}
            onChange={e => set('issue_date', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Échéance (optionnel)</label>
          <input
            type="date"
            value={form.due_date}
            onChange={e => set('due_date', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optionnel)</label>
          <input
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Description / notes…"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ─── Subtask row ─────────────────────────────────────────────────────────────

interface SubtaskRowProps {
  subtask: Subtask;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string) => void;
}

function SubtaskRow({ subtask, onToggle, onDelete, onEdit }: SubtaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);

  const commit = () => {
    if (title.trim() && title !== subtask.title) onEdit(subtask.id, title.trim());
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 pl-10 pr-3 py-1.5 hover:bg-gray-50 group/sub rounded-lg">
      <button
        onClick={() => onToggle(subtask.id, !subtask.completed)}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          subtask.completed
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        {subtask.completed && <Check size={10} className="text-white" strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 text-xs px-1 py-0.5 border border-blue-300 rounded focus:outline-none"
        />
      ) : (
        <span
          className={`flex-1 text-xs ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
          onDoubleClick={() => setEditing(true)}
        >
          {subtask.title}
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors">
          <Pencil size={11} />
        </button>
        <button onClick={() => onDelete(subtask.id)} className="p-0.5 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Add subtask input ────────────────────────────────────────────────────────

interface AddSubtaskInputProps {
  taskId: string;
  onAdd: (taskId: string, title: string) => Promise<void>;
}

function AddSubtaskInput({ taskId, onAdd }: AddSubtaskInputProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const commit = async () => {
    if (!title.trim()) { setOpen(false); return; }
    await onAdd(taskId, title.trim());
    setTitle('');
    ref.current?.focus();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 pl-10 pr-3 py-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
      >
        <Plus size={12} /> Ajouter une sous-tâche
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 pl-10 pr-3 py-1.5">
      <div className="w-4 h-4 rounded border-2 border-dashed border-gray-300 shrink-0" />
      <input
        ref={ref}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
        onBlur={() => { if (!title.trim()) setOpen(false); }}
        placeholder="Titre de la sous-tâche…"
        className="flex-1 text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <button onClick={commit} className="text-xs text-blue-600 font-medium hover:text-blue-800">OK</button>
      <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
    </div>
  );
}

// ─── Sort direction helper ────────────────────────────────────────────────────

type SortKey = 'title' | 'client' | 'priority' | 'issue_date' | 'due_date' | 'status';

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey | null; dir: 'asc' | 'desc' }) {
  if (active !== col) return <ArrowUpDown size={12} className="text-gray-300 ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500 ml-0.5" />
    : <ChevronDown size={12} className="text-blue-500 ml-0.5" />;
}

// ─── Main TodoPage component ─────────────────────────────────────────────────

export function TodoPage() {
  const navigate = useNavigate();
  useLoadClients();
  const { clients } = useAppState();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [completedOpen, setCompletedOpen] = useState(true);

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!supabaseEnabled) { setLoading(false); return; }
    try {
      const data = await taskApi.listTasks();
      setTasks(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const applySortToActive = (list: Task[]): Task[] => {
    if (!sortKey) return sortTasksByPriority(list);
    return [...list].sort((a, b) => {
      let av: string | number = '', bv: string | number = '';
      switch (sortKey) {
        case 'title':     av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case 'client':    av = clientMap[a.client_id ?? ''] ?? ''; bv = clientMap[b.client_id ?? ''] ?? ''; break;
        case 'priority':  av = PRIORITY_ORDER[a.priority]; bv = PRIORITY_ORDER[b.priority]; break;
        case 'issue_date':av = a.issue_date; bv = b.issue_date; break;
        case 'due_date':  av = a.due_date ?? '9999'; bv = b.due_date ?? '9999'; break;
        case 'status':    av = a.status; bv = b.status; break;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  const activeTasks = applySortToActive(tasks.filter(t => t.status !== 'completed'));
  const completedTasks = tasks.filter(t => t.status === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const handleCreate = async (form: TaskFormData) => {
    setSaving(true);
    try {
      const payload: CreateTaskPayload = {
        title: form.title.trim(),
        description: form.description,
        client_id: form.client_id || null,
        priority: form.priority,
        status: form.status,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
      };
      const created = await taskApi.createTask(payload);
      setTasks(prev => [created, ...prev]);
      setShowCreate(false);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, form: TaskFormData) => {
    setSaving(true);
    try {
      const payload: UpdateTaskPayload = {
        title: form.title.trim(),
        description: form.description,
        client_id: form.client_id || null,
        priority: form.priority,
        status: form.status,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
      };
      const updated = await taskApi.updateTask(id, payload);
      setTasks(prev => prev.map(t => t.id === id ? { ...updated, subtasks: t.subtasks } : t));
      setEditingId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette tâche ?')) return;
    try {
      await taskApi.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) { setError((e as Error).message); }
  };

  const handleToggleComplete = async (task: Task) => {
    const wasCompleted = task.status === 'completed';
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === task.id
        ? { ...t, status: wasCompleted ? 'todo' : 'completed', completed_at: wasCompleted ? null : new Date().toISOString() }
        : t
    ));
    try {
      if (wasCompleted) await taskApi.reopenTask(task.id);
      else await taskApi.completeTask(task.id);
    } catch (e) {
      setError((e as Error).message);
      setTasks(prev => prev.map(t => t.id === task.id ? task : t)); // rollback
    }
  };

  // ── Subtask CRUD ──────────────────────────────────────────────────────────
  const handleAddSubtask = async (taskId: string, title: string) => {
    try {
      const sub = await taskApi.createSubtask({ task_id: taskId, title });
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), sub] } : t
      ));
      setExpandedIds(s => new Set(s).add(taskId));
    } catch (e) { setError((e as Error).message); }
  };

  const handleToggleSubtask = async (taskId: string, subId: string, completed: boolean) => {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id !== taskId ? t : {
        ...t,
        subtasks: (t.subtasks ?? []).map(s =>
          s.id === subId ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null } : s
        ),
      }
    ));
    try {
      await taskApi.toggleSubtask(subId, completed);
    } catch (e) {
      setError((e as Error).message);
      await loadTasks(); // rollback via reload
    }
  };

  const handleEditSubtask = async (taskId: string, subId: string, title: string) => {
    try {
      const updated = await taskApi.updateSubtask(subId, { title });
      setTasks(prev => prev.map(t =>
        t.id !== taskId ? t : {
          ...t,
          subtasks: (t.subtasks ?? []).map(s => s.id === subId ? updated : s),
        }
      ));
    } catch (e) { setError((e as Error).message); }
  };

  const handleDeleteSubtask = async (taskId: string, subId: string) => {
    try {
      await taskApi.deleteSubtask(subId);
      setTasks(prev => prev.map(t =>
        t.id !== taskId ? t : { ...t, subtasks: (t.subtasks ?? []).filter(s => s.id !== subId) }
      ));
    } catch (e) { setError((e as Error).message); }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Counts ────────────────────────────────────────────────────────────────
  const countByPriority = (p: TaskPriority) => activeTasks.filter(t => t.priority === p).length;

  // ── Render ────────────────────────────────────────────────────────────────

  const thClass = 'text-left text-xs font-medium text-gray-500 py-2.5 px-3 select-none cursor-pointer hover:text-gray-700 whitespace-nowrap';

  const renderTaskRow = (task: Task, completed = false) => {
    const isEditing = editingId === task.id;
    const isExpanded = expandedIds.has(task.id);
    const subtasks = task.subtasks ?? [];
    const hasSubtasks = subtasks.length > 0;
    const doneSubtasks = subtasks.filter(s => s.completed).length;
    const clientName = task.client_id ? (clientMap[task.client_id] ?? '—') : '—';
    const clientInitials = clientName !== '—' ? clientName.slice(0, 2).toUpperCase() : null;
    const overdue = isOverdue(task.due_date) && !completed;

    return (
      <div key={task.id}>
        {/* Edit form inline */}
        {isEditing ? (
          <div className="px-3 py-3 border-b border-gray-100">
            <TaskForm
              initial={{
                title: task.title,
                description: task.description,
                client_id: task.client_id ?? '',
                priority: task.priority,
                status: task.status,
                issue_date: task.issue_date,
                due_date: task.due_date ?? '',
              }}
              clients={clients}
              onSave={form => handleUpdate(task.id, form)}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          </div>
        ) : (
          <div className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors group ${!completed ? PRIORITY_ROW[task.priority] : 'pl-1'}`}>
            <div className={`flex items-center gap-2 px-3 py-2.5 ${completed ? 'opacity-60' : ''}`}>
              {/* Checkbox */}
              <button
                onClick={() => handleToggleComplete(task)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {completed && <Check size={11} className="text-white" strokeWidth={3} />}
              </button>

              {/* Expand toggle */}
              <button
                onClick={() => hasSubtasks && toggleExpanded(task.id)}
                className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors ${hasSubtasks ? 'text-gray-400 hover:text-gray-600' : 'text-transparent cursor-default'}`}
              >
                {hasSubtasks && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              </button>

              {/* Title + description */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {task.title}
                </span>
                {task.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5 max-w-md">{task.description}</p>
                )}
                {hasSubtasks && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {doneSubtasks}/{subtasks.length} sous-tâches
                  </p>
                )}
              </div>

              {/* Client */}
              <div className="w-32 shrink-0">
                {clientInitials ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {clientInitials}
                    </span>
                    <span className="text-xs text-gray-600 truncate">{clientName}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </div>

              {/* Priority */}
              <div className="w-36 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
                  {PRIORITY_ICON[task.priority]}
                  {PRIORITY_LABELS[task.priority]}
                </span>
              </div>

              {/* Issue date */}
              <div className="w-24 shrink-0 text-xs text-gray-500 flex items-center gap-1">
                <Calendar size={11} className="text-gray-400 shrink-0" />
                {fmtDate(task.issue_date)}
              </div>

              {/* Due date */}
              <div className={`w-24 shrink-0 text-xs flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                <Calendar size={11} className={`shrink-0 ${overdue ? 'text-red-400' : 'text-gray-400'}`} />
                {fmtDate(task.due_date)}
              </div>

              {/* Status */}
              <div className="w-24 shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[task.status]}`}>
                  {STATUS_LABELS[task.status]}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {completed && (
                  <button
                    onClick={() => handleToggleComplete(task)}
                    title="Rouvrir"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  onClick={() => setEditingId(task.id)}
                  title="Modifier"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  title="Supprimer"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Subtasks (when expanded) */}
            {isExpanded && !completed && (
              <div className="pb-2">
                {subtasks.map(sub => (
                  <SubtaskRow
                    key={sub.id}
                    subtask={sub}
                    onToggle={(id, v) => handleToggleSubtask(task.id, id, v)}
                    onDelete={id => handleDeleteSubtask(task.id, id)}
                    onEdit={(id, title) => handleEditSubtask(task.id, id, title)}
                  />
                ))}
                <AddSubtaskInput taskId={task.id} onAdd={handleAddSubtask} />
              </div>
            )}

            {/* Add subtask when not expanded but task is active */}
            {!isExpanded && !completed && !hasSubtasks && (
              <AddSubtaskInput taskId={task.id} onAdd={handleAddSubtask} />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNav />

      <main className="pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Tâches</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {activeTasks.length} actives · {completedTasks.length} terminées
              </p>
            </div>
            <button
              onClick={() => { setShowCreate(v => !v); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Nouvelle tâche
            </button>
          </div>

          {/* Priority summary badges */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {(['urgent_important', 'urgent', 'important', 'normal'] as TaskPriority[]).map(p => (
              <div key={p} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2.5 min-w-[120px]">
                {PRIORITY_ICON[p]}
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">{PRIORITY_LABELS[p]}</p>
                  <p className="text-xl font-bold text-gray-800 leading-none">{countByPriority(p)}</p>
                </div>
              </div>
            ))}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2.5 min-w-[120px]">
              <Check size={13} className="text-green-500" />
              <div>
                <p className="text-[10px] text-gray-500 font-medium">Terminées</p>
                <p className="text-xl font-bold text-gray-800 leading-none">{completedTasks.length}</p>
              </div>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <div className="mb-6">
              <TaskForm
                clients={clients}
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
                saving={saving}
              />
            </div>
          )}

          {/* Active tasks table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-6">
            {/* Table header */}
            <div className="flex items-center gap-2 px-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="w-5 shrink-0" />
              <div className="w-5 shrink-0" />
              <button className={`${thClass} flex-1 text-left`} onClick={() => handleSort('title')}>
                Tâche <SortIcon col="title" active={sortKey} dir={sortDir} />
              </button>
              <button className={`${thClass} w-32`} onClick={() => handleSort('client')}>
                Client <SortIcon col="client" active={sortKey} dir={sortDir} />
              </button>
              <button className={`${thClass} w-36`} onClick={() => handleSort('priority')}>
                Priorité <SortIcon col="priority" active={sortKey} dir={sortDir} />
              </button>
              <button className={`${thClass} w-24`} onClick={() => handleSort('issue_date')}>
                Émission <SortIcon col="issue_date" active={sortKey} dir={sortDir} />
              </button>
              <button className={`${thClass} w-24`} onClick={() => handleSort('due_date')}>
                Échéance <SortIcon col="due_date" active={sortKey} dir={sortDir} />
              </button>
              <button className={`${thClass} w-24`} onClick={() => handleSort('status')}>
                Statut <SortIcon col="status" active={sortKey} dir={sortDir} />
              </button>
              <div className="w-[88px] shrink-0 py-2.5 px-3 text-xs font-medium text-gray-500">Actions</div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">Chargement…</div>
            ) : activeTasks.length === 0 ? (
              <div className="py-16 text-center">
                <Check size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune tâche active.</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  + Créer une tâche
                </button>
              </div>
            ) : (
              activeTasks.map(t => renderTaskRow(t, false))
            )}
          </div>

          {/* Completed tasks section */}
          {completedTasks.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <button
                onClick={() => setCompletedOpen(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                {completedOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                <span className="text-sm font-semibold text-gray-700">Tâches terminées</span>
                <span className="ml-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {completedTasks.length}
                </span>
              </button>

              {completedOpen && completedTasks.map(t => renderTaskRow(t, true))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default TodoPage;
