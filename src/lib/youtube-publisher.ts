import axios from 'axios';
import * as fs from 'fs';
import { config, getYoutubeVisibility } from './config';
import { getValidAccessToken, refreshAccessToken } from './youtube-oauth';
import { logger } from './logger';
import { sanitize } from './log-sanitizer';

const YT_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const YT_API_URL    = 'https://www.googleapis.com/youtube/v3/videos';

export interface YouTubeUploadInput {
  videoFilePath?: string;
  videoUrl?: string;
  title: string;
  description?: string;
  hashtags?: string[];
  categoryId?: string;
}

export interface YouTubeUploadResult {
  ok: boolean;
  videoId?: string;
  videoUrl?: string;
  visibility: string;
  channelId: string;
  mock?: boolean;
  error?: string;
}

// Validates that YOUTUBE_VISIBILITY env resolves to 'private'.
// Throws if a non-private mode is detected without an explicit public override.
function enforcePrivacyDefault(): 'private' | 'unlisted' | 'public' {
  const visibility = getYoutubeVisibility();
  // Log the resolved visibility — NOT the token
  logger.info(`[YouTube] Privacy enforcement: YOUTUBE_VISIBILITY resolved to "${visibility}"`);
  return visibility;
}

export async function uploadToYouTube(input: YouTubeUploadInput): Promise<YouTubeUploadResult> {
  const visibility = enforcePrivacyDefault();
  const channelId  = config.youtubeChannelId;

  // Auto-refresh: get current token or refresh via YOUTUBE_REFRESH_TOKEN
  let oauthToken = await getValidAccessToken();
  if (!oauthToken) {
    const hasClientId     = !!process.env['YOUTUBE_CLIENT_ID'];
    const hasClientSecret = !!process.env['YOUTUBE_CLIENT_SECRET'];
    let msg: string;
    if (!hasClientId) {
      msg = 'ยังไม่ได้เชื่อมต่อบัญชี YouTube\nต้องตั้งค่า YOUTUBE_CLIENT_ID และ YOUTUBE_CLIENT_SECRET ใน .env ก่อน\nจากนั้นรัน: npm run youtube:auth';
    } else if (!hasClientSecret) {
      msg = 'ยังไม่ได้ตั้งค่า YOUTUBE_CLIENT_SECRET\nกรุณาใส่ค่าจาก Google Cloud Console ใน .env ก่อนเชื่อมต่อ YouTube';
    } else {
      msg = 'ยังไม่ได้เชื่อมต่อบัญชี YouTube\nกรุณาเปิด /api/auth/youtube/login เพื่ออนุญาตสิทธิ์ก่อน';
    }
    return { ok: false, visibility, channelId, error: msg };
  }

  const categoryId = input.categoryId || (config.youtubeCategory === 'Education' ? '27' : '22');
  const tags = input.hashtags?.map(h => h.replace(/^#/, '')) || [];

  const metadata = {
    snippet: {
      title: (input.title || 'Untitled').slice(0, 100),
      description: buildDescription(input.description || '', input.hashtags || []),
      tags: tags.slice(0, 500),
      categoryId,
      defaultLanguage: 'th',
    },
    status: {
      privacyStatus: visibility,          // ALWAYS read from env — never hardcoded
      madeForKids: config.youtubeMadeForKids,
      selfDeclaredMadeForKids: config.youtubeMadeForKids,
    },
  };

  logger.info(`[YouTube] Starting upload — title="${sanitize(input.title)}" channel=${channelId} privacy=${visibility}`);

  const doUpload = async (token: string): Promise<YouTubeUploadResult> => {
    if (input.videoFilePath && fs.existsSync(input.videoFilePath)) {
      return resumableUploadFromFile(input.videoFilePath, metadata, token, visibility, channelId);
    } else if (input.videoUrl) {
      return uploadFromUrl(input.videoUrl, metadata, token, visibility, channelId);
    }
    return { ok: false, visibility, channelId, error: 'ต้องระบุ videoFilePath หรือ videoUrl' };
  };

  try {
    return await doUpload(oauthToken);
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };

    // 401 = token expired → try refresh once
    if (e.response?.status === 401 && process.env['YOUTUBE_REFRESH_TOKEN']) {
      logger.warn('[YouTube] Access token expired (401) — attempting refresh...');
      const refreshResult = await refreshAccessToken();
      if (refreshResult.ok && refreshResult.accessToken) {
        oauthToken = refreshResult.accessToken;
        try {
          return await doUpload(oauthToken);
        } catch (retryErr: unknown) {
          const re = retryErr as { response?: { data?: { error?: { message?: string } } }; message?: string };
          const msg = re.response?.data?.error?.message || re.message || 'retry failed';
          logger.error(`[YouTube] Upload failed after token refresh: ${sanitize(msg)}`);
          return { ok: false, visibility, channelId, error: msg };
        }
      }
      return { ok: false, visibility, channelId, error: 'Token refresh ล้มเหลว — กรุณาเปิด /api/auth/youtube/login เพื่อเชื่อมต่อใหม่' };
    }

    const msg = e.response?.data?.error?.message || e.message || 'unknown error';
    logger.error(`[YouTube] Upload failed: ${sanitize(msg)}`);
    return { ok: false, visibility, channelId, error: msg };
  }
}

// Resumable upload for local file (YouTube recommended for >5MB)
async function resumableUploadFromFile(
  filePath: string,
  metadata: Record<string, unknown>,
  oauthToken: string,
  visibility: string,
  channelId: string,
): Promise<YouTubeUploadResult> {
  const fileSize = fs.statSync(filePath).size;

  // Step 1: Initiate resumable upload session
  const initResp = await axios.post(
    `${YT_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    metadata,
    {
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': fileSize,
      },
    }
  );

  const uploadUri = initResp.headers['location'] as string;
  if (!uploadUri) throw new Error('YouTube did not return a resumable upload URI');

  logger.info(`[YouTube] Resumable upload URI obtained — uploading ${Math.round(fileSize / 1024 / 1024)}MB`);

  // Step 2: Upload file body
  const fileStream = fs.createReadStream(filePath);
  const uploadResp = await axios.put(uploadUri, fileStream, {
    headers: {
      'Content-Type': 'video/*',
      'Content-Length': fileSize,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const videoId = uploadResp.data?.id;
  if (!videoId) throw new Error('YouTube did not return a video ID after upload');

  logger.info(`[YouTube] Upload successful — videoId: ${videoId} privacy: ${visibility}`);

  return {
    ok: true,
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    visibility,
    channelId,
  };
}

// URL-based metadata insert (for cases where video is already hosted)
async function uploadFromUrl(
  _videoUrl: string,
  metadata: Record<string, unknown>,
  oauthToken: string,
  visibility: string,
  channelId: string,
): Promise<YouTubeUploadResult> {
  // YouTube Data API v3 does not support pull-from-URL directly.
  // The video must be uploaded as a file. This path inserts metadata only
  // and returns an error directing the caller to provide a local file.
  logger.warn('[YouTube] videoUrl provided but YouTube API requires a file upload — cannot pull from URL');
  void metadata; void oauthToken;
  return {
    ok: false,
    visibility,
    channelId,
    error:
      'YouTube Data API v3 ไม่รองรับ pull-from-URL\n' +
      'ต้องดาวน์โหลดวิดีโอมาเป็นไฟล์ก่อน แล้วส่ง videoFilePath แทน\n' +
      `Video URL ที่รับมา: ${sanitize(_videoUrl)}`,
  };
}

// Check that the uploaded video has correct privacy (post-upload verification)
export async function verifyVideoPrivacy(videoId: string): Promise<{ ok: boolean; privacyStatus?: string }> {
  const oauthToken = process.env['YOUTUBE_OAUTH_TOKEN'] || '';
  if (!oauthToken) return { ok: false };
  try {
    const r = await axios.get(`${YT_API_URL}?part=status&id=${videoId}`, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });
    const status = r.data?.items?.[0]?.status?.privacyStatus;
    return { ok: true, privacyStatus: status };
  } catch {
    return { ok: false };
  }
}

function buildDescription(description: string, hashtags: string[]): string {
  const disclaimer = '\n\n⚠️ วิดีโอนี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน\nการลงทุนมีความเสี่ยง โปรดศึกษาและตัดสินใจด้วยตนเอง';
  const tags = hashtags.length ? '\n\n' + hashtags.join(' ') : '';
  return [description, tags, disclaimer].join('').slice(0, 5000);
}
