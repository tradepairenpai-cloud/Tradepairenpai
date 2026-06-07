import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { checkGeminiCli, runGeminiResearch } from '../lib/cli-tools';

export class GeminiResearchAgent extends BaseAgent {
  name = 'gemini-research' as const;
  thaiLabel = 'เอเจนต์วิจัย (Gemini)';

  async run(input: unknown): Promise<AgentResult> {
    const prompt = typeof input === 'string' ? input : JSON.stringify(input);
    this.setStatus('running', prompt.slice(0, 80));
    this.log('info', `Researching: ${prompt.slice(0, 100)}`);

    const check = await checkGeminiCli();
    if (!check.ok) {
      this.log('warn', `Gemini CLI not available (${check.error}) — returning mock research`);
      this.setStatus('completed', 'mock research');
      return {
        ok: true,
        output: `[MOCK RESEARCH] Topic: ${prompt}\n\nKey points:\n1. Finance literacy is critical for Gen Z.\n2. Short-form video (15-30s) drives highest retention.\n3. Recommended angle: "เคล็ดลับการออม" (savings tip) with relatable scenario.`,
        mock: true,
      };
    }

    const result = await runGeminiResearch(prompt);
    const status = result.ok ? 'completed' : 'failed';
    this.setStatus(status, result.ok ? 'done' : result.error || 'error');
    return { ok: result.ok, output: result.stdout, error: result.error };
  }
}
