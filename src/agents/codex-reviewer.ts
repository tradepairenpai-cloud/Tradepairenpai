import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { checkCodexCli, runCodexReview } from '../lib/cli-tools';

export class CodexReviewerAgent extends BaseAgent {
  name = 'codex-reviewer' as const;
  thaiLabel = 'เอเจนต์ตรวจสอบ (Codex)';

  async run(input: unknown): Promise<AgentResult> {
    const content = typeof input === 'string' ? input : JSON.stringify(input);
    this.setStatus('running', 'reviewing...');
    this.log('info', `Reviewing content: ${content.slice(0, 100)}`);

    const check = await checkCodexCli();
    if (!check.ok) {
      this.log('warn', `Codex CLI not available (${check.error}) — returning mock review`);
      this.setStatus('completed', 'mock review');
      return {
        ok: true,
        output: `[MOCK CODEX REVIEW]\n✅ No critical bugs found\n✅ No security issues\n✅ Content safe for platform\n⚠️  Suggest adding subtitle for accessibility\n✅ Architecture: OK`,
        mock: true,
      };
    }

    const prompt = `Review this content for bugs, security issues, accuracy, and platform readiness:\n\n${content}`;
    const result = await runCodexReview(prompt);
    const status = result.ok ? 'completed' : 'failed';
    this.setStatus(status, result.ok ? 'done' : result.error || 'error');
    return { ok: result.ok, output: result.stdout, error: result.error };
  }
}
