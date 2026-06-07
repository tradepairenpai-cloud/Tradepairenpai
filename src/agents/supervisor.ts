import { BaseAgent } from './base-agent';
import { AgentResult, Task, TaskStep } from './types';
import { GeminiResearchAgent } from './gemini-research';
import { ClaudeBuilderAgent } from './claude-builder';
import { CodexReviewerAgent } from './codex-reviewer';
import { AssetFinderAgent } from './asset-finder';
import { VoiceoverAgent } from './voiceover';
import { VideoRenderAgent } from './video-render';
import { QAAgent } from './qa';
import { eventBus } from './event-bus';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class SupervisorAgent extends BaseAgent {
  name = 'supervisor' as const;
  thaiLabel = 'ผู้ควบคุม (Supervisor)';

  private gemini = new GeminiResearchAgent();
  private claude = new ClaudeBuilderAgent();
  private codex = new CodexReviewerAgent();
  private assetFinder = new AssetFinderAgent();
  private voiceover = new VoiceoverAgent();
  private videoRender = new VideoRenderAgent();
  private qa = new QAAgent();

  async run(input: unknown): Promise<AgentResult> {
    const taskDescription = typeof input === 'string' ? input : JSON.stringify(input);
    const task: Task = {
      id: uid(),
      description: taskDescription,
      steps: [],
      status: 'running',
      createdAt: Date.now(),
    };

    this.setStatus('running', taskDescription.slice(0, 80));
    this.log('info', `New task: ${taskDescription}`);
    eventBus.emitTaskUpdate(task);

    const results: Record<string, unknown> = {};

    // Step 1: Research
    const researchStep = this.addStep(task, 'gemini-research', 'Research topic and angle', taskDescription);
    const researchResult = await this.runStep(task, researchStep, () =>
      this.gemini.run(`Research content angle for: ${taskDescription}`)
    );
    results['research'] = researchResult.output;

    // Step 2: Write script
    const scriptPrompt = `Based on this research:\n${JSON.stringify(results['research'])}\n\nWrite a 30-second TikTok video script in Thai for: ${taskDescription}`;
    const scriptStep = this.addStep(task, 'claude-builder', 'Write video script', scriptPrompt);
    const scriptResult = await this.runStep(task, scriptStep, () =>
      this.claude.run(scriptPrompt)
    );
    const script = scriptResult.output as string;
    results['script'] = script;

    // Step 3: Find assets (parallel with voiceover)
    const assetStep = this.addStep(task, 'asset-finder', 'Find video assets', { query: taskDescription, type: 'video', count: 5 });
    const voiceStep = this.addStep(task, 'voiceover', 'Generate Thai voiceover', { text: script, language: 'thai' });

    const [assetResult, voiceResult] = await Promise.all([
      this.runStep(task, assetStep, () => this.assetFinder.run({ query: taskDescription, type: 'video', count: 5 })),
      this.runStep(task, voiceStep, () => this.voiceover.run({ text: script, language: 'thai' })),
    ]);
    results['assets'] = assetResult.output;
    results['voiceover'] = voiceResult.output;

    // Step 4: Render video
    const renderStep = this.addStep(task, 'video-render', 'Render 9:16 video', {});
    const renderResult = await this.runStep(task, renderStep, () =>
      this.videoRender.run({
        templateId: 'default-9x16-template',
        modifications: { script, assets: results['assets'] },
        waitForCompletion: false,
      })
    );
    results['render'] = renderResult.output;

    // Step 5: Code review
    const reviewStep = this.addStep(task, 'codex-reviewer', 'Review content quality', script);
    const reviewResult = await this.runStep(task, reviewStep, () =>
      this.codex.run(script)
    );
    results['review'] = reviewResult.output;

    // Step 6: QA
    const renderData = results['render'] as { url?: string; mock?: boolean } | null;
    const voiceData = results['voiceover'] as { filePath?: string } | null;
    const qaStep = this.addStep(task, 'qa', 'QA check readiness', {});
    const qaResult = await this.runStep(task, qaStep, () =>
      this.qa.run({
        filePaths: voiceData?.filePath ? [voiceData.filePath] : [],
        videoUrl: renderData?.url,
        isVideoMock: renderData?.mock === true,
        script: script || '',
        platform: 'tiktok',
      })
    );
    results['qa'] = qaResult.output;

    const qaReport = qaResult.output as {
      status: 'ready' | 'warning' | 'not_ready';
      ready: boolean;
      checksPassed: number;
      checksTotal: number;
      warnings: string[];
      errors: string[];
      summary: string;
    };
    task.status = 'done';
    task.completedAt = Date.now();
    task.finalReport = this.buildReport(taskDescription, results, qaReport);

    this.setStatus('completed', 'Task complete');
    eventBus.emitTaskUpdate(task);
    this.log('info', `Task ${task.id} completed`);

    return { ok: true, output: task };
  }

  private addStep(task: Task, agent: TaskStep['agent'], description: string, input: unknown): TaskStep {
    const step: TaskStep = {
      id: uid(),
      agent,
      description,
      input,
      status: 'pending',
    };
    task.steps.push(step);
    eventBus.emitTaskUpdate(task);
    return step;
  }

  private async runStep(task: Task, step: TaskStep, fn: () => Promise<AgentResult>): Promise<AgentResult> {
    step.status = 'running';
    step.startedAt = Date.now();
    eventBus.emitTaskUpdate(task);

    try {
      const result = await fn();
      step.status = result.ok ? 'done' : 'failed';
      step.output = result.output;
      step.error = result.error;
      step.completedAt = Date.now();
      eventBus.emitTaskUpdate(task);
      return result;
    } catch (err: unknown) {
      const e = err as Error;
      step.status = 'failed';
      step.error = e.message;
      step.completedAt = Date.now();
      eventBus.emitTaskUpdate(task);
      this.log('error', `Step ${step.id} failed: ${e.message}`);
      return { ok: false, output: null, error: e.message };
    }
  }

  private buildReport(
    description: string,
    results: Record<string, unknown>,
    qa: {
      status: 'ready' | 'warning' | 'not_ready';
      ready: boolean;
      checksPassed: number;
      checksTotal: number;
      warnings: string[];
      errors: string[];
      summary: string;
    }
  ): string {
    const qaWarningLines =
      qa.warnings.length > 0
        ? qa.warnings.map(w => `  ⚠️  ${w}`).join('\n')
        : '  (ไม่มีคำเตือน)';

    const qaErrorLines =
      qa.errors.length > 0
        ? qa.errors.map(e => `  ❌  ${e}`).join('\n')
        : '  (ไม่มีข้อผิดพลาด)';

    return `
# รายงานสรุปงาน (Final Report)

**งาน:** ${description}

**การวิจัย (Gemini):**
${JSON.stringify(results['research'], null, 2)}

**สคริปต์ (Claude):**
${results['script']}

**Asset:**
${JSON.stringify(results['assets'], null, 2)}

**เสียงพูด (ElevenLabs):**
${JSON.stringify(results['voiceover'], null, 2)}

**วิดีโอ (Creatomate):**
${JSON.stringify(results['render'], null, 2)}

**ตรวจสอบ (Codex):**
${results['review']}

**QA — ผลการตรวจสอบ:**
สถานะ : ${qa.status === 'ready' ? '✅ พร้อมเผยแพร่' : qa.status === 'warning' ? '⚠️ พร้อมทดสอบ แต่ยังไม่ใช่วิดีโอจริง' : '❌ ต้องแก้ไข'}
ผ่าน   : ${qa.checksPassed}/${qa.checksTotal} การตรวจสอบ
คำเตือน:
${qaWarningLines}
ข้อผิดพลาด:
${qaErrorLines}
`.trim();
  }
}
