import { AgentName, AgentResult } from './types';
import { eventBus } from './event-bus';
import { logger } from '../lib/logger';

export abstract class BaseAgent {
  abstract name: AgentName;
  abstract thaiLabel: string;

  protected setStatus(status: import('./types').AgentStatus, task: string) {
    eventBus.emitAgentUpdate({ agent: this.name, status, task, timestamp: Date.now() });
  }

  protected log(level: 'info' | 'warn' | 'error', message: string) {
    logger[level](`[${this.name}] ${message}`);
    eventBus.emitLog({ level, agent: this.name, message, timestamp: Date.now() });
  }

  abstract run(input: unknown): Promise<AgentResult>;
}
