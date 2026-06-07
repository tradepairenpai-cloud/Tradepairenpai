import { EventEmitter } from 'events';
import { AgentName, AgentStatus, Task } from './types';

export interface AgentEvent {
  agent: AgentName;
  status: AgentStatus;
  task: string;
  timestamp: number;
}

export interface LogEvent {
  level: 'info' | 'warn' | 'error';
  agent: AgentName | 'system';
  message: string;
  timestamp: number;
}

class AgentEventBus extends EventEmitter {
  emitAgentUpdate(event: AgentEvent) {
    this.emit('agent:update', event);
  }
  emitLog(event: LogEvent) {
    this.emit('log', event);
  }
  emitTaskUpdate(task: Task) {
    this.emit('task:update', task);
  }
}

export const eventBus = new AgentEventBus();
