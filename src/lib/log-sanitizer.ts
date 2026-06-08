import * as dotenv from 'dotenv';

dotenv.config();

const SECRET_ENV_KEYS = [
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY',
  'CREATOMATE_API_KEY', 'ELEVENLABS_API_KEY', 'PEXELS_API_KEY',
  'TIKTOK_API_KEY', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET',
  'TIKTOK_REDIRECT_URI', 'TIKTOK_REDIRECT_URL',
  'YOUTUBE_API_KEY', 'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_OAUTH_TOKEN', 'YOUTUBE_REFRESH_TOKEN',
  'META_API_KEY',
];

// Collect non-trivial, non-placeholder secret values at startup.
// Also re-evaluated at call time so tokens added after startup are caught.
const secretValues: string[] = SECRET_ENV_KEYS
  .map(k => process.env[k] || '')
  .filter(v => v.length > 8 && !v.startsWith('your_'));

export function sanitize(text: string): string {
  if (!text) return text;
  // Re-evaluate dynamic secrets (e.g. OAuth tokens set after startup)
  const live = SECRET_ENV_KEYS
    .map(k => process.env[k] || '')
    .filter(v => v.length > 8 && !v.startsWith('your_'));
  const all = Array.from(new Set([...secretValues, ...live]));
  if (!all.length) return text;
  let out = text;
  for (const s of all) {
    // Replace all occurrences; use indexOf loop to avoid regex injection
    let i = out.indexOf(s);
    while (i !== -1) {
      out = out.slice(0, i) + '[REDACTED]' + out.slice(i + s.length);
      i = out.indexOf(s, i + '[REDACTED]'.length);
    }
  }
  return out;
}
