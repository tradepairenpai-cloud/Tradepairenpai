import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { createRender, getRenderStatus } from '../lib/creatomate';

export interface VideoRenderInput {
  templateId: string;
  modifications?: Record<string, unknown>;
  waitForCompletion?: boolean;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

export class VideoRenderAgent extends BaseAgent {
  name = 'video-render' as const;
  thaiLabel = 'เอเจนต์เรนเดอร์วิดีโอ (Creatomate)';

  async run(input: unknown): Promise<AgentResult> {
    const {
      templateId,
      modifications = {},
      waitForCompletion = true,
      pollIntervalMs = 5000,
      maxWaitMs = 300000,
    } = input as VideoRenderInput;

    this.setStatus('running', `rendering template: ${templateId}`);
    this.log('info', `Starting render for template: ${templateId}`);

    const render = await createRender({ templateId, modifications });
    if (!render.ok) {
      this.setStatus('failed', render.error || 'render failed');
      return { ok: false, output: null, error: render.error };
    }

    if (render.mock || !waitForCompletion) {
      this.setStatus('completed', render.url || 'mock url');
      return { ok: true, output: render, mock: render.mock };
    }

    const renderId = render.renderId!;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
      const status = await getRenderStatus(renderId);
      this.log('info', `Render status: ${status.status}`);

      if (status.status === 'succeeded') {
        this.setStatus('completed', status.url || 'done');
        return { ok: true, output: status };
      }
      if (status.status === 'failed') {
        this.setStatus('failed', 'render failed at Creatomate');
        return { ok: false, output: null, error: 'Creatomate render failed' };
      }
    }

    this.setStatus('failed', 'render timeout');
    return { ok: false, output: null, error: 'Render timed out' };
  }
}
