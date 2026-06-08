import * as fs from 'fs';
import * as path from 'path';
import { AgentName, AgentState, Task } from '../agents/types';

const DATA_DIR  = path.resolve('./data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents-state.json');
const TASKS_FILE  = path.join(DATA_DIR, 'tasks.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch { /* ignore corrupt file */ }
  return fallback;
}

function writeJson(file: string, data: unknown): void {
  try {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch { /* ignore write errors */ }
}

// ── Agent state ───────────────────────────────────────────────────────────────

export function loadAgentStates(): Partial<Record<AgentName, AgentState>> {
  return readJson(AGENTS_FILE, {});
}

export function saveAgentState(state: AgentState): void {
  const current = loadAgentStates();
  current[state.name] = state;
  writeJson(AGENTS_FILE, current);
}

// ── Task history ──────────────────────────────────────────────────────────────

export function loadTasks(limit = 100): Task[] {
  const all = readJson<Task[]>(TASKS_FILE, []);
  return all.slice(-limit);
}

export function saveTask(task: Task): void {
  const all = readJson<Task[]>(TASKS_FILE, []);
  const idx = all.findIndex(t => t.id === task.id);
  if (idx >= 0) all[idx] = task;
  else all.push(task);
  writeJson(TASKS_FILE, all.slice(-100)); // keep last 100 tasks
}
