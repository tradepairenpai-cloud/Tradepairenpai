import { AgentName, AgentResult } from '../agents/types';
import { eventBus } from '../agents/event-bus';
import { SupervisorAgent } from '../agents/supervisor';
import { GeminiResearchAgent } from '../agents/gemini-research';
import { ClaudeBuilderAgent } from '../agents/claude-builder';
import { CodexReviewerAgent } from '../agents/codex-reviewer';
import { AssetFinderAgent } from '../agents/asset-finder';
import { VoiceoverAgent } from '../agents/voiceover';
import { VideoRenderAgent } from '../agents/video-render';
import { QAAgent } from '../agents/qa';
import { PublisherAgent } from '../agents/publisher';
import * as fs from 'fs';
import * as path from 'path';

const VALID_AGENTS = new Set<AgentName>([
  'supervisor', 'trend-research', 'claude-builder', 'asset-finder',
  'voiceover', 'subtitle', 'video-render', 'qa', 'publisher',
  'analytics', 'codex-reviewer', 'gemini-research',
]);

type RunnableAgent = { run: (input: unknown) => Promise<AgentResult> };

const AGENT_FACTORIES: Partial<Record<AgentName, () => RunnableAgent>> = {
  'supervisor':      () => new SupervisorAgent(),
  'gemini-research': () => new GeminiResearchAgent(),
  'claude-builder':  () => new ClaudeBuilderAgent(),
  'codex-reviewer':  () => new CodexReviewerAgent(),
  'asset-finder':    () => new AssetFinderAgent(),
  'voiceover':       () => new VoiceoverAgent(),
  'video-render':    () => new VideoRenderAgent(),
  'qa':              () => new QAAgent(),
  'publisher':       () => new PublisherAgent(),
};

// Agents without real implementations get a simulated lifecycle
const DEMO_ONLY_AGENTS = new Set<AgentName>(['trend-research', 'subtitle', 'analytics']);

interface RunEntry {
  promise: Promise<AgentResult>;
  taskDescription: string;
  startedAt: number;
  cancelled: boolean;
}

class AgentRunner {
  private running = new Map<AgentName, RunEntry>();
  private lastTask = new Map<AgentName, string>();
  private readonly logDir = path.resolve('./logs');

  constructor() {
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
  }

  isValid(name: string): name is AgentName {
    return VALID_AGENTS.has(name as AgentName);
  }

  async start(name: AgentName, taskDescription: string): Promise<{ ok: boolean; error?: string }> {
    if (this.running.has(name)) return { ok: false, error: `${name} กำลังทำงานอยู่` };

    this.lastTask.set(name, taskDescription);

    if (DEMO_ONLY_AGENTS.has(name)) {
      const entry: RunEntry = {
        promise: Promise.resolve({ ok: true, output: null }),
        taskDescription, startedAt: Date.now(), cancelled: false,
      };
      this.running.set(name, entry);
      eventBus.emitAgentUpdate({ agent: name, status: 'running', task: taskDescription, timestamp: Date.now() });
      eventBus.emitLog({ level: 'warn', agent: name, message: `[DEMO] ${name} ยังไม่มี implementation จริง — จำลองการทำงาน`, timestamp: Date.now() });
      this.writeLog(name, `[DEMO] started: ${taskDescription}`);

      setTimeout(() => {
        if (!entry.cancelled) {
          this.running.delete(name);
          eventBus.emitAgentUpdate({ agent: name, status: 'completed', task: taskDescription, timestamp: Date.now() });
          eventBus.emitLog({ level: 'info', agent: name, message: `[DEMO] เสร็จสิ้น (จำลอง)`, timestamp: Date.now() });
          this.writeLog(name, '[DEMO] completed (simulated)');
        }
      }, 3000 + Math.random() * 5000);
      return { ok: true };
    }

    const factory = AGENT_FACTORIES[name];
    if (!factory) return { ok: false, error: `No implementation for ${name}` };

    const entry: RunEntry = {
      promise: Promise.resolve({ ok: true, output: null }),
      taskDescription, startedAt: Date.now(), cancelled: false,
    };

    const promise = factory().run(taskDescription)
      .then(result => {
        if (!entry.cancelled) this.running.delete(name);
        this.writeLog(name, `finished: ok=${result.ok} mock=${result.mock ?? false}`);
        return result;
      })
      .catch(err => {
        if (!entry.cancelled) this.running.delete(name);
        this.writeLog(name, `error: ${(err as Error).message}`);
        return { ok: false, output: null, error: (err as Error).message };
      });

    entry.promise = promise;
    this.running.set(name, entry);
    this.writeLog(name, `started: ${taskDescription}`);
    return { ok: true };
  }

  stop(name: AgentName): { ok: boolean } {
    const entry = this.running.get(name);
    if (entry) { entry.cancelled = true; this.running.delete(name); }
    eventBus.emitAgentUpdate({ agent: name, status: 'idle', task: '', timestamp: Date.now() });
    eventBus.emitLog({ level: 'warn', agent: name, message: 'หยุดโดย Dashboard', timestamp: Date.now() });
    this.writeLog(name, 'stopped by user');
    return { ok: true };
  }

  async restart(name: AgentName, taskDescription?: string): Promise<{ ok: boolean; error?: string }> {
    this.stop(name);
    await new Promise(r => setTimeout(r, 300));
    return this.start(name, taskDescription || this.lastTask.get(name) || 'restart');
  }

  async retry(name: AgentName): Promise<{ ok: boolean; error?: string }> {
    const last = this.lastTask.get(name);
    if (!last) return { ok: false, error: 'ไม่มีงานก่อนหน้าให้ลองใหม่' };
    this.stop(name);
    await new Promise(r => setTimeout(r, 300));
    return this.start(name, last);
  }

  isRunning(name: AgentName): boolean { return this.running.has(name); }
  getLastTask(name: AgentName): string | undefined { return this.lastTask.get(name); }

  getLogsForAgent(name: AgentName, lines = 120): string[] {
    const file = path.join(this.logDir, `${name}.log`);
    try {
      if (!fs.existsSync(file)) return [];
      return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-lines);
    } catch { return []; }
  }

  private writeLog(name: AgentName, msg: string): void {
    const line = `[${new Date().toISOString()}] [${name}] ${msg}\n`;
    try {
      fs.appendFileSync(path.join(this.logDir, `${name}.log`), line);
      fs.appendFileSync(path.join(this.logDir, 'combined.log'), line);
    } catch { /* ignore write errors */ }
  }
}

export const agentRunner = new AgentRunner();
