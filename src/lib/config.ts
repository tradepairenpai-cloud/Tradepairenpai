import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.startsWith('your_')) return '';
  return val;
}

function parseList(key: string, defaults: string[]): string[] {
  const raw = process.env[key];
  if (!raw) return defaults;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export const config = {
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  creatomateApiKey: requireEnv('CREATOMATE_API_KEY'),
  elevenlabsApiKey: requireEnv('ELEVENLABS_API_KEY'),
  pexelsApiKey: requireEnv('PEXELS_API_KEY'),
  tiktokApiKey: requireEnv('TIKTOK_API_KEY'),
  tiktokClientKey: requireEnv('TIKTOK_CLIENT_KEY'),
  tiktokClientSecret: requireEnv('TIKTOK_CLIENT_SECRET'),
  // Accept both TIKTOK_REDIRECT_URL (canonical) and TIKTOK_REDIRECT_URI (legacy)
  tiktokRedirectUri: process.env['TIKTOK_REDIRECT_URL'] || process.env['TIKTOK_REDIRECT_URI'] || '',
  youtubeApiKey: requireEnv('YOUTUBE_API_KEY'),
  youtubeClientId: requireEnv('YOUTUBE_CLIENT_ID'),
  youtubeClientSecret: requireEnv('YOUTUBE_CLIENT_SECRET'),
  youtubeRedirectUri: process.env['YOUTUBE_REDIRECT_URI'] || 'http://localhost:3000/api/auth/youtube/callback',
  metaApiKey: requireEnv('META_API_KEY'),
  appPort: parseInt(process.env['APP_PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  // DEMO_MODE=true (default) allows mock render URLs without failing QA.
  // Set DEMO_MODE=false and provide a real CREATOMATE_API_KEY for production.
  demoMode: process.env['DEMO_MODE'] !== 'false',
  outputDir: path.resolve(process.env['OUTPUT_DIR'] || './outputs'),
  assetDir: path.resolve(process.env['ASSET_DIR'] || './assets'),
  logLevel: process.env['LOG_LEVEL'] || 'info',

  // ── YouTube Publisher Config ────────────────────────────────────────────────
  // YOUTUBE_VISIBILITY must be 'private' | 'unlisted' | 'public'.
  // Defaults to 'private'. Never uploads as public unless explicitly set.
  youtubeVisibility: (process.env['YOUTUBE_VISIBILITY'] || 'private') as 'private' | 'unlisted' | 'public',
  youtubeChannelId: process.env['YOUTUBE_CHANNEL_ID'] || '',
  youtubeAutoPublish: process.env['YOUTUBE_AUTO_PUBLISH'] === 'true',
  youtubeRequireOwnerApproval: process.env['YOUTUBE_REQUIRE_OWNER_APPROVAL'] !== 'false',
  youtubeCategory: process.env['YOUTUBE_CATEGORY'] || 'Education',
  youtubeMadeForKids: process.env['YOUTUBE_MADE_FOR_KIDS'] === 'true',

  // ── Platform Access Control ─────────────────────────────────────────────────
  // Only platforms listed in PUBLISH_ALLOWED_PLATFORMS are permitted.
  // Platforms in PUBLISH_BLOCKED_PLATFORMS are always rejected, even if in allowed list.
  publishAllowedPlatforms: parseList('PUBLISH_ALLOWED_PLATFORMS', ['youtube']),
  publishBlockedPlatforms: parseList('PUBLISH_BLOCKED_PLATFORMS', ['tiktok', 'facebook', 'instagram', 'meta']),
  nonYoutubePublisherLocked: process.env['NON_YOUTUBE_PUBLISHER_LOCKED'] !== 'false',
  requireOwnerApprovalForNonYoutube: process.env['REQUIRE_OWNER_APPROVAL_FOR_NON_YOUTUBE'] !== 'false',
};

export function mockVideoAllowed(): boolean {
  // Explicit DEMO_MODE env var is the authoritative override
  const explicit = process.env['DEMO_MODE'];
  if (explicit === 'false') return false;
  if (explicit === 'true')  return true;
  // If not set, fall back to NODE_ENV safety net
  return config.nodeEnv !== 'production';
}

export function ensureDirs() {
  [config.outputDir, config.assetDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

export function checkApiKeys(): Record<string, boolean> {
  return {
    // LLM APIs
    ANTHROPIC_API_KEY:    !!config.anthropicApiKey,
    OPENAI_API_KEY:       !!config.openaiApiKey,
    GEMINI_API_KEY:       !!config.geminiApiKey,
    // Content production
    CREATOMATE_API_KEY:   !!config.creatomateApiKey,
    ELEVENLABS_API_KEY:   !!config.elevenlabsApiKey,
    PEXELS_API_KEY:       !!config.pexelsApiKey,
    // Publishing — standardized names
    TIKTOK_CLIENT_KEY:    !!config.tiktokClientKey,
    TIKTOK_CLIENT_SECRET: !!config.tiktokClientSecret,
    TIKTOK_REDIRECT_URL:  !!config.tiktokRedirectUri,
    YOUTUBE_API_KEY:      !!config.youtubeApiKey,
    META_API_KEY:         !!config.metaApiKey,
  };
}

// Returns the enforced YouTube privacy level — always 'private' unless explicitly overridden.
export function getYoutubeVisibility(): 'private' | 'unlisted' | 'public' {
  const v = config.youtubeVisibility;
  if (v === 'public' || v === 'unlisted') return v;
  return 'private';
}

// Returns true if the platform is allowed to publish.
// A platform is blocked if: it's in publishBlockedPlatforms OR not in publishAllowedPlatforms.
export function isPlatformAllowed(platform: string): boolean {
  if (config.publishBlockedPlatforms.includes(platform)) return false;
  if (config.publishAllowedPlatforms.length > 0 && !config.publishAllowedPlatforms.includes(platform)) return false;
  return true;
}

// Returns a summary of YouTube publisher configuration for health endpoints.
export function checkYoutubeConfig(): {
  channelId: string;
  visibility: string;
  autoPublish: boolean;
  oauthReady: boolean;
  hasClientId: boolean;
  hasRefreshToken: boolean;
  oauthConnected: boolean;
  redirectUri: string;
  allowedPlatforms: string[];
  blockedPlatforms: string[];
  nonYoutubeLocked: boolean;
} {
  const hasToken   = !!process.env['YOUTUBE_OAUTH_TOKEN'];
  const hasRefresh = !!process.env['YOUTUBE_REFRESH_TOKEN'];

  // Resolve redirect URI using same logic as youtube-oauth.ts
  const explicitUri    = process.env['YOUTUBE_REDIRECT_URI'] || '';
  const codespaceName  = process.env['CODESPACE_NAME'] || '';
  const forwardDomain  = process.env['GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN'] || '';
  const port           = String(config.appPort);
  const redirectUri = explicitUri
    || (codespaceName && forwardDomain
        ? `https://${codespaceName}-${port}.${forwardDomain}/api/auth/youtube/callback`
        : `http://localhost:${port}/api/auth/youtube/callback`);

  return {
    channelId:        config.youtubeChannelId,
    visibility:       getYoutubeVisibility(),
    autoPublish:      config.youtubeAutoPublish,
    oauthReady:       hasToken,
    hasClientId:      !!config.youtubeClientId,
    hasRefreshToken:  hasRefresh,
    oauthConnected:   hasToken || hasRefresh,
    redirectUri,
    allowedPlatforms: config.publishAllowedPlatforms,
    blockedPlatforms: config.publishBlockedPlatforms,
    nonYoutubeLocked: config.nonYoutubePublisherLocked,
  };
}

// Publisher readiness: what is actually usable right now
export function checkPublisherReadiness(): Record<string, { ready: boolean; note: string }> {
  const isDemo = config.demoMode;
  return {
    tiktok: {
      ready: isDemo || (!!config.tiktokClientKey && !!config.tiktokClientSecret && !!process.env['TIKTOK_USER_ACCESS_TOKEN']),
      note: isDemo
        ? 'Demo Mode — จำลองการโพสต์'
        : !config.tiktokClientKey
          ? 'ยังไม่ได้ตั้งค่า TIKTOK_CLIENT_KEY'
          : !process.env['TIKTOK_USER_ACCESS_TOKEN']
            ? 'ต้องผ่าน OAuth flow เพื่อรับ TIKTOK_USER_ACCESS_TOKEN'
            : 'พร้อมใช้งาน',
    },
    youtube: {
      ready: isDemo || !!process.env['YOUTUBE_OAUTH_TOKEN'],
      note: isDemo
        ? 'Demo Mode — จำลองการโพสต์'
        : !config.youtubeApiKey
          ? 'ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY'
          : !process.env['YOUTUBE_OAUTH_TOKEN']
            ? 'API Key ใช้ read-only เท่านั้น — ต้องใช้ YOUTUBE_OAUTH_TOKEN สำหรับอัปโหลด'
            : 'พร้อมใช้งาน',
    },
    instagram: {
      ready: isDemo || (!!config.metaApiKey && !!process.env['INSTAGRAM_ACCOUNT_ID']),
      note: isDemo
        ? 'Demo Mode — จำลองการโพสต์'
        : !config.metaApiKey
          ? 'ยังไม่ได้ตั้งค่า META_API_KEY (Page Access Token)'
          : !process.env['INSTAGRAM_ACCOUNT_ID']
            ? 'ต้องตั้งค่า INSTAGRAM_ACCOUNT_ID'
            : 'พร้อมใช้งาน',
    },
  };
}
