import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

async function runWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs = 30000
): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
    if (e.killed) return { ok: false, stdout: '', stderr: '', error: `timeout after ${timeoutMs}ms` };
    if (e.code === 'ENOENT') return { ok: false, stdout: '', stderr: '', error: `command not found: ${cmd}` };
    return {
      ok: false,
      stdout: e.stdout?.trim() || '',
      stderr: e.stderr?.trim() || '',
      error: e.message,
    };
  }
}

export async function checkClaudeCli(): Promise<CliResult> {
  return runWithTimeout('claude', ['--version'], 5000);
}

export async function checkCodexCli(): Promise<CliResult> {
  return runWithTimeout('codex', ['--version'], 5000);
}

export async function checkGeminiCli(): Promise<CliResult> {
  return runWithTimeout('gemini', ['--version'], 5000);
}

export async function runClaudeTask(prompt: string): Promise<CliResult> {
  return runWithTimeout('claude', ['-p', prompt, '--output-format', 'text'], 120000);
}

export async function runCodexReview(prompt: string): Promise<CliResult> {
  return runWithTimeout('codex', ['-p', prompt], 120000);
}

export async function runGeminiResearch(prompt: string): Promise<CliResult> {
  return runWithTimeout('gemini', ['-p', prompt], 120000);
}

export async function checkAllClis(): Promise<Record<string, CliResult>> {
  const [claude, codex, gemini] = await Promise.all([
    checkClaudeCli(),
    checkCodexCli(),
    checkGeminiCli(),
  ]);
  return { claude, codex, gemini };
}
