import axios from 'axios';
import { config } from './config';
import { logger } from './logger';

const BASE_URL = 'https://api.pexels.com';

export interface PexelsAsset {
  id: number;
  url: string;
  previewUrl: string;
  duration?: number;
  width: number;
  height: number;
  type: 'video' | 'photo';
}

export interface SearchResult {
  ok: boolean;
  assets: PexelsAsset[];
  error?: string;
  mock?: boolean;
}

const MOCK_ASSETS: PexelsAsset[] = [
  { id: 1, url: 'https://mock.pexels.com/video/1.mp4', previewUrl: 'https://mock.pexels.com/img/1.jpg', duration: 15, width: 1080, height: 1920, type: 'video' },
  { id: 2, url: 'https://mock.pexels.com/video/2.mp4', previewUrl: 'https://mock.pexels.com/img/2.jpg', duration: 10, width: 1080, height: 1920, type: 'video' },
];

export async function searchVideos(query: string, perPage = 5): Promise<SearchResult> {
  if (!config.pexelsApiKey) {
    logger.warn('[Pexels] No API key — returning mock video assets');
    return { ok: true, assets: MOCK_ASSETS, mock: true };
  }
  try {
    const res = await axios.get(`${BASE_URL}/videos/search`, {
      params: { query, per_page: perPage, orientation: 'portrait' },
      headers: { Authorization: config.pexelsApiKey },
    });
    const assets: PexelsAsset[] = res.data.videos.map((v: Record<string, unknown>) => ({
      id: v['id'],
      url: (v['video_files'] as Record<string, unknown>[])[0]?.['link'],
      previewUrl: v['image'],
      duration: v['duration'],
      width: v['width'],
      height: v['height'],
      type: 'video',
    }));
    return { ok: true, assets };
  } catch (err: unknown) {
    const e = err as { message?: string };
    logger.error(`[Pexels] searchVideos error: ${e.message}`);
    return { ok: false, assets: [], error: e.message };
  }
}

export async function searchPhotos(query: string, perPage = 5): Promise<SearchResult> {
  if (!config.pexelsApiKey) {
    logger.warn('[Pexels] No API key — returning mock photo assets');
    return { ok: true, assets: MOCK_ASSETS.map(a => ({ ...a, type: 'photo' as const })), mock: true };
  }
  try {
    const res = await axios.get(`${BASE_URL}/v1/search`, {
      params: { query, per_page: perPage, orientation: 'portrait' },
      headers: { Authorization: config.pexelsApiKey },
    });
    const assets: PexelsAsset[] = res.data.photos.map((p: Record<string, unknown>) => ({
      id: p['id'],
      url: (p['src'] as Record<string, string>)['portrait'],
      previewUrl: (p['src'] as Record<string, string>)['tiny'],
      width: p['width'] as number,
      height: p['height'] as number,
      type: 'photo',
    }));
    return { ok: true, assets };
  } catch (err: unknown) {
    const e = err as { message?: string };
    logger.error(`[Pexels] searchPhotos error: ${e.message}`);
    return { ok: false, assets: [], error: e.message };
  }
}
