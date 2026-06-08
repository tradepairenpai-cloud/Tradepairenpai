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

// Builds an inline Creatomate source composition for a 9:16 dark trading video.
// No pre-created template needed — uses Creatomate's source API directly.
function buildVideoSource(script: string, bgVideoUrl: string): Record<string, unknown> {
  const elements: Record<string, unknown>[] = [];

  if (bgVideoUrl) {
    elements.push({
      type: 'video', track: 1, time: 0, duration: 52,
      source: bgVideoUrl, fit: 'cover', opacity: 0.25, volume: 0,
    });
  }

  // Dark overlay
  elements.push({
    type: 'shape', track: 2, time: 0, duration: 52,
    shape: 'rectangle', width: '100%', height: '100%',
    fill_color: 'rgba(10,10,10,0.78)',
  });

  // Scene 1 Hook (0-5s)
  elements.push(
    { type: 'text', track: 3, time: 0, duration: 5,
      text: '90%', font_weight: '900', font_size: 180,
      fill_color: '#FFD700', x_alignment: '50%', y_alignment: '38%', text_alignment: 'center' },
    { type: 'text', track: 4, time: 0.4, duration: 4.6,
      text: 'คนเทรดมือใหม่\nไม่รู้เรื่องนี้...',
      font_family: 'Sarabun', font_weight: '700', font_size: 68,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '62%',
      width: '85%', line_height: 1.4, text_alignment: 'center' },
  );

  // Scene 2 Title (5-11s)
  elements.push(
    { type: 'text', track: 3, time: 5, duration: 6,
      text: 'MARKET\nSTRUCTURE',
      font_weight: '900', font_size: 110, letter_spacing: 2,
      fill_color: '#FFD700', x_alignment: '50%', y_alignment: '42%', text_alignment: 'center',
      line_height: 1.1 },
    { type: 'text', track: 4, time: 5.5, duration: 5,
      text: 'สำหรับมือใหม่',
      font_family: 'Sarabun', font_size: 56,
      fill_color: '#AAAAAA', x_alignment: '50%', y_alignment: '65%', text_alignment: 'center' },
  );

  // Scene 3 Uptrend (11-22s)
  elements.push(
    { type: 'text', track: 3, time: 11, duration: 11,
      text: '📈  ขาขึ้น  (Uptrend)',
      font_family: 'Sarabun', font_weight: '700', font_size: 60,
      fill_color: '#00FF88', x_alignment: '50%', y_alignment: '25%', text_alignment: 'center' },
    { type: 'text', track: 4, time: 12, duration: 4,
      text: 'HH  =  Higher High\nยอดสูงขึ้นเรื่อยๆ',
      font_family: 'Sarabun', font_weight: '700', font_size: 52,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '48%',
      width: '85%', line_height: 1.5, text_alignment: 'center' },
    { type: 'text', track: 5, time: 16, duration: 6,
      text: 'HL  =  Higher Low\nก้นก็สูงขึ้นตาม',
      font_family: 'Sarabun', font_weight: '700', font_size: 52,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '65%',
      width: '85%', line_height: 1.5, text_alignment: 'center' },
  );

  // Scene 4 Downtrend (22-33s)
  elements.push(
    { type: 'text', track: 3, time: 22, duration: 11,
      text: '📉  ขาลง  (Downtrend)',
      font_family: 'Sarabun', font_weight: '700', font_size: 60,
      fill_color: '#FF4444', x_alignment: '50%', y_alignment: '25%', text_alignment: 'center' },
    { type: 'text', track: 4, time: 23, duration: 4,
      text: 'LH  =  Lower High\nยอดต่ำลงเรื่อยๆ',
      font_family: 'Sarabun', font_weight: '700', font_size: 52,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '48%',
      width: '85%', line_height: 1.5, text_alignment: 'center' },
    { type: 'text', track: 5, time: 27, duration: 6,
      text: 'LL  =  Lower Low\nก้นต่ำลงตาม',
      font_family: 'Sarabun', font_weight: '700', font_size: 52,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '65%',
      width: '85%', line_height: 1.5, text_alignment: 'center' },
  );

  // Scene 5 BOS (33-39s)
  elements.push(
    { type: 'text', track: 3, time: 33, duration: 6,
      text: '💥  BOS',
      font_weight: '900', font_size: 110,
      fill_color: '#FFD700', x_alignment: '50%', y_alignment: '35%', text_alignment: 'center' },
    { type: 'text', track: 4, time: 33.5, duration: 5.5,
      text: 'Break of Structure\nทะลุต่อ = เทรนด์ยังแข็งแรง ✅',
      font_family: 'Sarabun', font_weight: '700', font_size: 50,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '58%',
      width: '85%', line_height: 1.5, text_alignment: 'center' },
  );

  // Scene 6 CHoCH (39-45s)
  elements.push(
    { type: 'text', track: 3, time: 39, duration: 6,
      text: '⚡  CHoCH',
      font_weight: '900', font_size: 100,
      fill_color: '#FF8C00', x_alignment: '50%', y_alignment: '35%', text_alignment: 'center' },
    { type: 'text', track: 4, time: 39.5, duration: 5.5,
      text: 'Change of Character\nเทรนด์กำลังกลับตัว ⚠️',
      font_family: 'Sarabun', font_weight: '700', font_size: 50,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '58%',
      width: '85%', line_height: 1.5, text_alignment: 'center' },
  );

  // Scene 7 CTA (45-50s)
  elements.push(
    { type: 'text', track: 3, time: 45, duration: 5,
      text: 'HH · HL · LH · LL\nBOS · CHoCH',
      font_weight: '900', font_size: 80, letter_spacing: 1,
      fill_color: '#FFD700', x_alignment: '50%', y_alignment: '38%',
      text_alignment: 'center', line_height: 1.3 },
    { type: 'text', track: 4, time: 45.5, duration: 4.5,
      text: 'อ่าน Structure ก่อน กดออเดอร์ 🦅\n\nกด Follow → Order Block พรุ่งนี้ 🔥',
      font_family: 'Sarabun', font_weight: '700', font_size: 46,
      fill_color: '#FFFFFF', x_alignment: '50%', y_alignment: '68%',
      width: '85%', line_height: 1.6, text_alignment: 'center' },
  );

  // Disclaimer bar (50-52s)
  elements.push(
    { type: 'shape', track: 6, time: 50, duration: 2,
      shape: 'rectangle', width: '100%', height: 110,
      x_alignment: '50%', y_alignment: '96%', fill_color: '#111111' },
    { type: 'text', track: 7, time: 50, duration: 2,
      text: '⚠️ วิดีโอนี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน',
      font_family: 'Sarabun', font_size: 26, fill_color: '#AAAAAA',
      x_alignment: '50%', y_alignment: '96%', width: '90%', text_alignment: 'center' },
  );

  // Script reference stored as metadata (not rendered)
  void script;

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    duration: 52,
    frame_rate: 30,
    fill_color: '#0A0A0A',
    elements,
  };
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

    // Step 4: Render video — build inline Creatomate source composition
    const assetList = (results['assets'] as Array<{ url?: string }> | null) ?? [];
    const bgVideoUrl = assetList[0]?.url || '';
    const renderSource = buildVideoSource(script, bgVideoUrl);
    const renderStep = this.addStep(task, 'video-render', 'Render 9:16 video', {});
    const renderResult = await this.runStep(task, renderStep, () =>
      this.videoRender.run({
        source: renderSource,
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
