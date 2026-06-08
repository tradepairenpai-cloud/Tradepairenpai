import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { sanitize } from './log-sanitizer';

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_SCOPE    = 'https://www.googleapis.com/auth/youtube.upload';

// Auto-detect the correct redirect URI for this environment.
// Priority: YOUTUBE_REDIRECT_URI env → GitHub Codespace public URL → localhost fallback.
export function resolveRedirectUri(): string {
  const explicit = process.env['YOUTUBE_REDIRECT_URI'] || '';
  if (explicit) return explicit;

  // GitHub Codespaces: build public URL from CODESPACE_NAME + GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  const codespaceName = process.env['CODESPACE_NAME'] || '';
  const forwardDomain = process.env['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN'] || '';
  const port          = process.env['APP_PORT'] || '3000';
  if (codespaceName && forwardDomain) {
    return `https://${codespaceName}-${port}.${forwardDomain}/api/auth/youtube/callback`;
  }

  return `http://localhost:${port}/api/auth/youtube/callback`;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export function getYouTubeAuthUrl(): string {
  const clientId    = process.env['YOUTUBE_CLIENT_ID'] || '';
  const redirectUri = resolveRedirectUri();
  if (!clientId) return '';

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         YOUTUBE_SCOPE,
    access_type:   'offline',
    prompt:        'consent',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<{ ok: boolean; tokens?: OAuthTokens; error?: string }> {
  const clientId     = process.env['YOUTUBE_CLIENT_ID'] || '';
  const clientSecret = process.env['YOUTUBE_CLIENT_SECRET'] || '';
  const redirectUri  = process.env['YOUTUBE_REDIRECT_URI'] || 'http://localhost:3000/api/auth/youtube/callback';

  if (!clientId || !clientSecret) {
    return { ok: false, error: 'YOUTUBE_CLIENT_ID หรือ YOUTUBE_CLIENT_SECRET ยังไม่ได้ตั้งค่า' };
  }

  try {
    const resp = await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const tokens: OAuthTokens = resp.data as OAuthTokens;
    logger.info(`[YouTube OAuth] ได้รับ access_token สำเร็จ scope=${tokens.scope || YOUTUBE_SCOPE}`);

    if (tokens.access_token)  {
      process.env['YOUTUBE_OAUTH_TOKEN'] = tokens.access_token;
      persistEnvVar('YOUTUBE_OAUTH_TOKEN', tokens.access_token);
    }
    if (tokens.refresh_token) {
      process.env['YOUTUBE_REFRESH_TOKEN'] = tokens.refresh_token;
      persistEnvVar('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
    }

    return { ok: true, tokens };
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    const raw = JSON.stringify(e.response?.data || e.message || 'unknown');
    logger.error(`[YouTube OAuth] exchangeCode failed: ${sanitize(raw)}`);
    return { ok: false, error: `Google OAuth token exchange failed: ${sanitize(raw)}` };
  }
}

export async function refreshAccessToken(): Promise<{ ok: boolean; accessToken?: string; error?: string }> {
  const clientId     = process.env['YOUTUBE_CLIENT_ID'] || '';
  const clientSecret = process.env['YOUTUBE_CLIENT_SECRET'] || '';
  const refreshToken = process.env['YOUTUBE_REFRESH_TOKEN'] || '';

  if (!clientId || !clientSecret) {
    return { ok: false, error: 'YOUTUBE_CLIENT_ID หรือ YOUTUBE_CLIENT_SECRET ยังไม่ได้ตั้งค่า' };
  }
  if (!refreshToken) {
    return { ok: false, error: 'YOUTUBE_REFRESH_TOKEN ยังไม่ได้ตั้งค่า — ต้องผ่าน OAuth consent flow ก่อน' };
  }

  try {
    const resp = await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const newToken = (resp.data as { access_token: string }).access_token;
    logger.info('[YouTube OAuth] Refreshed access_token สำเร็จ');

    process.env['YOUTUBE_OAUTH_TOKEN'] = newToken;
    persistEnvVar('YOUTUBE_OAUTH_TOKEN', newToken);

    return { ok: true, accessToken: newToken };
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    const raw = JSON.stringify(e.response?.data || e.message || 'unknown');
    logger.error(`[YouTube OAuth] refresh failed: ${sanitize(raw)}`);
    return { ok: false, error: `Token refresh failed: ${sanitize(raw)}` };
  }
}

// Returns a valid access token or null.
// Prefers existing YOUTUBE_OAUTH_TOKEN; auto-refreshes via YOUTUBE_REFRESH_TOKEN if token missing.
export async function getValidAccessToken(): Promise<string | null> {
  const existing = process.env['YOUTUBE_OAUTH_TOKEN'] || '';
  if (existing) return existing;

  if (!process.env['YOUTUBE_REFRESH_TOKEN']) return null;

  const result = await refreshAccessToken();
  return result.ok && result.accessToken ? result.accessToken : null;
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return '***';
  return token.slice(0, 6) + '...' + token.slice(-4);
}

// Writes or replaces a KEY=VALUE line in .env (never logs the value)
function persistEnvVar(key: string, value: string): void {
  const envPath = path.resolve(process.cwd(), '.env');
  try {
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
  } catch (err) {
    logger.warn(`[YouTube OAuth] ไม่สามารถอัปเดต .env: ${(err as Error).message}`);
  }
}
