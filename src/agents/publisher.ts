import axios from 'axios';
import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { config, mockVideoAllowed, isPlatformAllowed, getYoutubeVisibility } from '../lib/config';
import { uploadToYouTube } from '../lib/youtube-publisher';

export interface PublishInput {
  videoUrl?: string;
  videoFilePath?: string;
  title: string;
  description?: string;
  hashtags?: string[];
  platforms?: Array<'tiktok' | 'youtube' | 'instagram'>;
}

export interface PlatformResult {
  platform: 'tiktok' | 'youtube' | 'instagram';
  status: 'success' | 'failed' | 'skipped';
  message: string;
  requiresSetup?: string;
  postUrl?: string;
  mock?: boolean;
}

export interface PublishOutput {
  platforms: PlatformResult[];
  anySuccess: boolean;
  requiresSetup: string[];
}

export class PublisherAgent extends BaseAgent {
  name = 'publisher' as const;
  thaiLabel = 'เอเจนต์เผยแพร่';

  async run(input: unknown): Promise<AgentResult> {
    const {
      videoUrl,
      videoFilePath,
      title = 'Untitled',
      description = '',
      hashtags = [],
      platforms = ['tiktok', 'youtube', 'instagram'],
    } = (input as PublishInput) || {};

    this.setStatus('running', `เผยแพร่ไปยัง [${platforms.join(', ')}]`);
    this.log('info', `เริ่มเผยแพร่: "${title}" → [${platforms.join(', ')}]`);

    if (!videoUrl && !videoFilePath) {
      this.setStatus('failed', 'ไม่มีแหล่งวิดีโอ');
      this.log('error', 'ต้องระบุ videoUrl หรือ videoFilePath');
      return { ok: false, output: null, error: 'ต้องระบุ videoUrl หรือ videoFilePath' };
    }

    const isDemoMode = mockVideoAllowed();
    if (isDemoMode) this.log('warn', '[DEMO MODE] กำลังจำลองการเผยแพร่ — ไม่ได้โพสต์จริง');

    // Platform access control — block all platforms not in PUBLISH_ALLOWED_PLATFORMS
    const allowedPlatforms = platforms.filter(p => isPlatformAllowed(p));
    const blockedPlatforms = platforms.filter(p => !isPlatformAllowed(p));
    if (blockedPlatforms.length > 0) {
      this.log('warn',
        `[PLATFORM GUARD] ถูกบล็อก: [${blockedPlatforms.join(', ')}] — ` +
        `NON_YOUTUBE_PUBLISHER_LOCKED=${config.nonYoutubePublisherLocked} ` +
        `อนุญาต: [${config.publishAllowedPlatforms.join(', ')}]`
      );
    }
    if (allowedPlatforms.length === 0) {
      const msg = `ทุก Platform ถูกบล็อก — อนุญาตเฉพาะ [${config.publishAllowedPlatforms.join(', ')}]`;
      this.setStatus('failed', msg);
      this.log('error', msg);
      return { ok: false, output: null, error: msg };
    }

    const results: PlatformResult[] = [];
    const requiresSetup: string[] = [];

    // Add blocked platform entries as skipped
    for (const blocked of blockedPlatforms) {
      results.push({
        platform: blocked as 'tiktok' | 'youtube' | 'instagram',
        status: 'skipped',
        message: `[PLATFORM GUARD] ${blocked} ถูกบล็อก — ระบบอนุญาตเฉพาะ [${config.publishAllowedPlatforms.join(', ')}]`,
      });
    }

    for (const platform of allowedPlatforms) {
      this.log('info', `กำลังเผยแพร่ไปยัง ${platform}...`);
      let result: PlatformResult;

      if (platform === 'tiktok')    result = await this.publishTikTok({ videoUrl, title, description, hashtags, isDemoMode });
      else if (platform === 'youtube') result = await this.publishYouTube({ videoUrl, videoFilePath, title, description, hashtags, isDemoMode });
      else                             result = await this.publishInstagram({ videoUrl, title, description, hashtags, isDemoMode });

      results.push(result);
      if (result.requiresSetup) requiresSetup.push(result.requiresSetup);

      const icon = result.status === 'success' ? '✅' : result.status === 'skipped' ? '⚠️' : '❌';
      this.log(result.status === 'failed' ? 'error' : 'info', `${icon} ${platform}: ${result.message}`);
    }

    const anySuccess = results.some(r => r.status === 'success');
    const allFailed  = results.every(r => r.status === 'failed');
    const output: PublishOutput = { platforms: results, anySuccess, requiresSetup };

    this.setStatus(
      anySuccess ? 'completed' : allFailed ? 'failed' : 'completed',
      anySuccess ? `เผยแพร่สำเร็จ ${results.filter(r => r.status === 'success').length}/${results.length}` : 'ต้องตั้งค่าเพิ่มเติม'
    );

    return { ok: !allFailed, output, mock: isDemoMode };
  }

  // ── TikTok Content Posting API v2 ────────────────────────────────────────────
  private async publishTikTok(opts: {
    videoUrl?: string; title: string; description: string; hashtags: string[]; isDemoMode: boolean;
  }): Promise<PlatformResult> {
    const { videoUrl, title, isDemoMode } = opts;

    if (!config.tiktokClientKey || !config.tiktokClientSecret) {
      return {
        platform: 'tiktok', status: 'skipped',
        message: 'ยังไม่ได้ตั้งค่า TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET',
        requiresSetup: 'TikTok: ตั้งค่า TIKTOK_CLIENT_KEY และ TIKTOK_CLIENT_SECRET ใน .env',
      };
    }

    if (isDemoMode) {
      return { platform: 'tiktok', status: 'success',
        message: '[DEMO] จำลองอัปโหลด TikTok สำเร็จ',
        postUrl: 'https://www.tiktok.com/@demo/video/0', mock: true };
    }

    // TikTok Content Posting API v2 requires a USER access token (not client credentials).
    // Client Key + Secret are used ONLY to initiate the OAuth flow and exchange auth codes.
    // To get a user_access_token: complete OAuth at https://developers.tiktok.com/doc/login-kit-web
    const userAccessToken = process.env['TIKTOK_USER_ACCESS_TOKEN'] || '';
    if (!userAccessToken) {
      return {
        platform: 'tiktok', status: 'failed',
        message: 'TikTok ต้องการ user_access_token (ไม่ใช่ Client Key)\nต้องผ่าน OAuth flow ก่อนเพื่อรับ user_access_token',
        requiresSetup:
          'TikTok: ดำเนินการ OAuth flow → รับ user_access_token → ตั้งค่า TIKTOK_USER_ACCESS_TOKEN ใน .env\n' +
          'อ้างอิง: https://developers.tiktok.com/doc/content-posting-api-get-started',
      };
    }

    try {
      this.log('info', 'TikTok: เริ่ม init video upload...');
      const resp = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          post_info: {
            title: title.slice(0, 150),
            privacy_level: 'MUTUAL_FOLLOW_FRIENDS',
            disable_duet: false, disable_comment: false, disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
        },
        { headers: { Authorization: `Bearer ${userAccessToken}`, 'Content-Type': 'application/json; charset=UTF-8' } }
      );
      const publishId = resp.data?.data?.publish_id;
      if (!publishId) throw new Error('ไม่ได้รับ publish_id จาก TikTok');
      this.log('info', `TikTok: upload initiated — publish_id: ${publishId}`);
      return { platform: 'tiktok', status: 'success', message: `TikTok upload started — publish_id: ${publishId}` };
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })
        ?.response?.data?.error?.message || (err as Error).message || 'unknown';
      return { platform: 'tiktok', status: 'failed', message: `TikTok upload failed: ${msg}` };
    }
  }

  // ── YouTube Data API v3 ──────────────────────────────────────────────────────
  // Privacy is ALWAYS read from YOUTUBE_VISIBILITY env var (default: 'private').
  // Never uploads as public unless YOUTUBE_VISIBILITY=public is explicitly set.
  private async publishYouTube(opts: {
    videoUrl?: string; videoFilePath?: string; title: string; description: string; hashtags: string[]; isDemoMode: boolean;
  }): Promise<PlatformResult> {
    const { videoUrl, videoFilePath, title, description, hashtags, isDemoMode } = opts;

    // Resolve visibility BEFORE any mock check — must always be logged
    const visibility = getYoutubeVisibility();
    this.log('info', `YouTube: privacy enforcement → privacyStatus="${visibility}" channel=${config.youtubeChannelId}`);

    if (isDemoMode) {
      this.log('warn', `[DEMO] YouTube upload จำลอง — visibility ที่จะใช้จริง: "${visibility}"`);
      return {
        platform: 'youtube', status: 'success',
        message: `[DEMO] จำลองอัปโหลด YouTube สำเร็จ — visibility: ${visibility}`,
        postUrl: `https://www.youtube.com/watch?v=demo_${visibility}`, mock: true,
      };
    }

    if (!config.youtubeApiKey && !process.env['YOUTUBE_OAUTH_TOKEN']) {
      return {
        platform: 'youtube', status: 'skipped',
        message: 'ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY หรือ YOUTUBE_OAUTH_TOKEN',
        requiresSetup: 'YouTube: ตั้งค่า YOUTUBE_OAUTH_TOKEN ใน .env (API Key อย่างเดียวใช้ upload ไม่ได้)',
      };
    }

    const result = await uploadToYouTube({
      videoUrl, videoFilePath, title, description, hashtags,
      categoryId: config.youtubeCategory === 'Education' ? '27' : '22',
    });

    if (result.ok) {
      this.log('info', `YouTube: อัปโหลดสำเร็จ — videoId: ${result.videoId} privacy: ${result.visibility}`);
      return {
        platform: 'youtube', status: 'success',
        message: `อัปโหลด YouTube สำเร็จ — privacy: ${result.visibility} — ${result.videoUrl}`,
        postUrl: result.videoUrl,
      };
    }

    return {
      platform: 'youtube', status: 'failed',
      message: result.error || 'YouTube upload failed',
      requiresSetup: result.error?.includes('YOUTUBE_OAUTH_TOKEN')
        ? 'YouTube: ต้องใช้ YOUTUBE_OAUTH_TOKEN — ดู https://developers.google.com/youtube/v3/guides/uploading_a_video'
        : undefined,
    };
  }

  // ── Instagram Graph API ──────────────────────────────────────────────────────
  private async publishInstagram(opts: {
    videoUrl?: string; title: string; description: string; hashtags: string[]; isDemoMode: boolean;
  }): Promise<PlatformResult> {
    const { videoUrl, description, hashtags, isDemoMode } = opts;

    if (!config.metaApiKey) {
      return {
        platform: 'instagram', status: 'skipped',
        message: 'ยังไม่ได้ตั้งค่า META_API_KEY (Instagram Page Access Token)',
        requiresSetup: 'Instagram: ตั้งค่า META_API_KEY (Page Access Token) ใน .env',
      };
    }

    const igAccountId = process.env['INSTAGRAM_ACCOUNT_ID'] || '';
    if (!igAccountId && !isDemoMode) {
      return {
        platform: 'instagram', status: 'failed',
        message: 'ต้องระบุ INSTAGRAM_ACCOUNT_ID (Instagram Business Account ID)',
        requiresSetup: 'Instagram: ตั้งค่า INSTAGRAM_ACCOUNT_ID ใน .env — ดูได้จาก Facebook Business Manager',
      };
    }

    if (isDemoMode) {
      return { platform: 'instagram', status: 'success',
        message: '[DEMO] จำลองโพสต์ Instagram Reels สำเร็จ',
        postUrl: 'https://instagram.com/p/demo/', mock: true };
    }

    try {
      this.log('info', 'Instagram: กำลังสร้าง media container...');
      const caption = [description, ...hashtags].filter(Boolean).join(' ');

      const containerResp = await axios.post(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        null,
        { params: { media_type: 'REELS', video_url: videoUrl, caption, access_token: config.metaApiKey } }
      );

      const creationId = containerResp.data?.id;
      if (!creationId) throw new Error('ไม่ได้รับ creation_id จาก Instagram');
      this.log('info', `Instagram: media container created (${creationId}) — รอประมวลผล...`);

      // Poll until FINISHED or ERROR (max 60s)
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const st = await axios.get(`https://graph.facebook.com/v19.0/${creationId}`,
          { params: { fields: 'status_code', access_token: config.metaApiKey } });
        if (st.data?.status_code === 'FINISHED') break;
        if (st.data?.status_code === 'ERROR') throw new Error('Instagram: ประมวลผล media ล้มเหลว');
        if (i === 11) throw new Error('Instagram: media processing timeout (60s)');
      }

      const pubResp = await axios.post(
        `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
        null,
        { params: { creation_id: creationId, access_token: config.metaApiKey } }
      );

      const postId = pubResp.data?.id;
      this.log('info', `Instagram: โพสต์สำเร็จ — post_id: ${postId}`);
      return { platform: 'instagram', status: 'success',
        message: `โพสต์ Instagram Reels สำเร็จ — post_id: ${postId}`,
        postUrl: `https://www.instagram.com/p/${postId}/` };
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })
        ?.response?.data?.error?.message;
      const msg = apiMsg || (err as Error).message || 'unknown';
      this.log('error', `Instagram publish failed: ${msg}`);
      return { platform: 'instagram', status: 'failed', message: `Instagram: ${msg}` };
    }
  }
}
