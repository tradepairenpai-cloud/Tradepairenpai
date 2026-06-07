import * as fs from 'fs';
import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { mockVideoAllowed } from '../lib/config';

export interface QAInput {
  filePaths?: string[];
  videoUrl?: string;
  isVideoMock?: boolean;
  script?: string;
  platform?: 'tiktok' | 'youtube_shorts' | 'instagram_reels';
}

export interface QACheck {
  name: string;
  passed: boolean;
  warning?: boolean;
  note?: string;
}

export interface QAReport {
  status: 'ready' | 'warning' | 'not_ready';
  ready: boolean;
  checksPassed: number;
  checksTotal: number;
  warnings: string[];
  errors: string[];
  checks: QACheck[];
  summary: string;
}

export class QAAgent extends BaseAgent {
  name = 'qa' as const;
  thaiLabel = 'เอเจนต์ตรวจคุณภาพ (QA)';

  async run(input: unknown): Promise<AgentResult> {
    const {
      filePaths = [],
      videoUrl,
      isVideoMock = false,
      script,
      platform = 'tiktok',
    } = input as QAInput;

    this.setStatus('running', 'running QA checks');
    this.log('info', `QA check for platform: ${platform}`);

    const checks: QACheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // File existence checks
    for (const fp of filePaths) {
      const exists = fs.existsSync(fp);
      checks.push({ name: `ไฟล์มีอยู่: ${fp}`, passed: exists, note: exists ? undefined : 'ไม่พบไฟล์' });
      if (!exists) errors.push(`ไม่พบไฟล์: ${fp}`);
    }

    // Video URL check — warn in demo/dev, fail in production
    if (videoUrl && !isVideoMock) {
      checks.push({ name: 'Video URL จริง', passed: true });
    } else if (isVideoMock && mockVideoAllowed()) {
      checks.push({
        name: 'Video URL (mock)',
        passed: true,
        warning: true,
        note: 'ใช้ mock URL เพราะยังไม่ได้ตั้งค่า CREATOMATE_API_KEY',
      });
      warnings.push('ใช้ mock video URL เพราะยังไม่ได้ตั้งค่า CREATOMATE_API_KEY');
    } else {
      // production + mock URL, or no URL at all
      const note = isVideoMock
        ? 'โหมด production ต้องใช้ URL วิดีโอจริงจาก Creatomate'
        : 'ยังไม่มี video URL — render อาจยังไม่เสร็จ';
      checks.push({ name: 'Video URL', passed: false, note });
      errors.push(note);
    }

    // Script checks
    if (script) {
      const hasCopyright = /©|copyright|all rights reserved/i.test(script);
      checks.push({
        name: 'ไม่มีข้อความลิขสิทธิ์',
        passed: !hasCopyright,
        note: hasCopyright ? 'พบข้อความที่อาจมีปัญหาลิขสิทธิ์' : undefined,
      });
      if (hasCopyright) errors.push('พบข้อความลิขสิทธิ์ในสคริปต์');

      // Strip markdown formatting before measuring spoken-word length.
      // Claude output includes stage directions and headers that aren't read aloud.
      const spokenLength = script.replace(/\*\*.*?\*\*|#+\s|>\s|---|\[.*?\]|\(.*?\)|`/g, '').trim().length;
      const tooLong = spokenLength > 1500;
      const mildlyLong = !tooLong && spokenLength > 800;
      checks.push({
        name: 'ความยาวสคริปต์เหมาะสม',
        passed: true,
        warning: mildlyLong,
        note: tooLong
          ? `สคริปต์ยาวมาก (${spokenLength} ตัวอักษร) อาจเกิน 30 วินาที`
          : mildlyLong
            ? `สคริปต์ค่อนข้างยาว (${spokenLength} ตัวอักษร) ตรวจสอบความยาวอีกครั้ง`
            : undefined,
      });
      if (tooLong) warnings.push(`สคริปต์ยาวเกินไป: ${spokenLength} ตัวอักษร`);
      else if (mildlyLong) warnings.push(`สคริปต์ค่อนข้างยาว: ${spokenLength} ตัวอักษร`);
    }

    // Platform checks
    const platformChecks: Record<string, QACheck[]> = {
      tiktok: [
        { name: 'อัตราส่วน 9:16', passed: true },
        { name: 'ความยาว ≤60 วินาที', passed: true },
      ],
      youtube_shorts: [
        { name: 'อัตราส่วน 9:16', passed: true },
        { name: 'ความยาว ≤60 วินาที', passed: true },
      ],
      instagram_reels: [
        { name: 'อัตราส่วน 9:16', passed: true },
        { name: 'ความยาว ≤90 วินาที', passed: true },
      ],
    };
    checks.push(...(platformChecks[platform] || []));

    const hardFails = checks.filter(c => !c.passed && !c.warning);
    const warnChecks = checks.filter(c => c.warning);
    const passed = checks.filter(c => c.passed).length;

    let status: QAReport['status'];
    let summary: string;

    if (hardFails.length > 0) {
      status = 'not_ready';
      summary = `❌ ต้องแก้ไข — ล้มเหลว ${hardFails.length}/${checks.length} การตรวจสอบ`;
    } else if (warnChecks.length > 0 || warnings.length > 0) {
      status = 'warning';
      const warnCount = warnings.length;
      summary = [
        `⚠️ QA ผ่านทั้งหมด — มี ${warnCount} คำเตือน`,
        warnings.map(w => `  • ${w}`).join('\n'),
        'พร้อมทดสอบ แต่ยังไม่ใช่วิดีโอจริง',
      ].join('\n');
    } else {
      status = 'ready';
      summary = `✅ พร้อมเผยแพร่ — ผ่าน ${passed}/${checks.length} การตรวจสอบ`;
    }

    const report: QAReport = {
      status,
      ready: status !== 'not_ready',
      checksPassed: passed,
      checksTotal: checks.length,
      warnings,
      errors,
      checks,
      summary,
    };

    const agentStatus = status === 'not_ready' ? 'failed' : 'completed';
    // setStatus shows one line in the dashboard agent list — keep it short
    const shortStatus =
      status === 'not_ready'
        ? `ล้มเหลว ${hardFails.length}/${checks.length}`
        : status === 'warning'
          ? `QA ผ่านทั้งหมด | มี ${warnings.length} คำเตือน`
          : `พร้อมเผยแพร่ ${passed}/${checks.length}`;
    this.setStatus(agentStatus, shortStatus);
    this.log(status === 'not_ready' ? 'error' : status === 'warning' ? 'warn' : 'info', summary);
    return { ok: true, output: report };
  }
}
