import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { checkClaudeCli, runClaudeTask } from '../lib/cli-tools';

export class ClaudeBuilderAgent extends BaseAgent {
  name = 'claude-builder' as const;
  thaiLabel = 'เอเจนต์สร้างเนื้อหา (Claude)';

  async run(input: unknown): Promise<AgentResult> {
    const prompt = typeof input === 'string' ? input : JSON.stringify(input);
    this.setStatus('running', prompt.slice(0, 80));
    this.log('info', `Building: ${prompt.slice(0, 100)}`);

    const check = await checkClaudeCli();
    if (!check.ok) {
      this.log('warn', `Claude CLI not available (${check.error}) — returning mock output`);
      this.setStatus('completed', 'mock build');
      return {
        ok: true,
        output: `[MOCK CLAUDE OUTPUT]\n\nสคริปต์วิดีโอ TikTok 30 วินาที:\n\n[Hook 0-3s] "คุณรู้ไหมว่าคนส่วนใหญ่ใช้เงินเดือนหมดก่อนสิ้นเดือน?"\n[Problem 3-10s] เพราะไม่มีระบบออม\n[Solution 10-20s] ลองกฎ 50/30/20 — 50% ใช้จ่าย, 30% ของที่อยาก, 20% ออม\n[CTA 20-30s] ลองทำตามดูสิ แล้ว comment บอก!`,
        mock: true,
      };
    }

    const result = await runClaudeTask(prompt);
    const status = result.ok ? 'completed' : 'failed';
    this.setStatus(status, result.ok ? 'done' : result.error || 'error');
    return { ok: result.ok, output: result.stdout, error: result.error };
  }
}
