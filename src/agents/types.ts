export type AgentStatus = 'idle' | 'running' | 'blocked' | 'failed' | 'completed';

export type AgentName =
  | 'supervisor'
  | 'trend-research'
  | 'claude-builder'
  | 'asset-finder'
  | 'voiceover'
  | 'subtitle'
  | 'video-render'
  | 'qa'
  | 'publisher'
  | 'analytics'
  | 'codex-reviewer'
  | 'gemini-research';

export interface AgentState {
  name: AgentName;
  thaiLabel: string;
  status: AgentStatus;
  currentTask: string;
  lastUpdated: number;
}

export interface TaskStep {
  id: string;
  agent: AgentName;
  description: string;
  input: unknown;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface Task {
  id: string;
  description: string;
  steps: TaskStep[];
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAt: number;
  completedAt?: number;
  finalReport?: string;
}

export interface AgentResult {
  ok: boolean;
  output: unknown;
  error?: string;
  mock?: boolean;
}
