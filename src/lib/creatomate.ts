import axios from 'axios';
import { config } from './config';
import { logger } from './logger';

const BASE_URL = 'https://api.creatomate.com/v1';

export interface RenderRequest {
  templateId?: string;
  source?: Record<string, unknown>;
  modifications?: Record<string, unknown>;
}

export interface RenderResult {
  ok: boolean;
  renderId?: string;
  status?: string;
  url?: string;
  error?: string;
  mock?: boolean;
}

function mockRender(req: RenderRequest): RenderResult {
  logger.warn('[Creatomate] No API key — returning mock render result');
  return {
    ok: true,
    renderId: `mock-${Date.now()}`,
    status: 'mock',
    url: `https://mock.creatomate.com/renders/mock-${Date.now()}.mp4`,
    mock: true,
  };
}

export async function createRender(req: RenderRequest): Promise<RenderResult> {
  if (!config.creatomateApiKey) return mockRender(req);
  if (!req.templateId && !req.source) return mockRender(req);
  try {
    const body: Record<string, unknown> = { modifications: req.modifications ?? {} };
    if (req.source) {
      body['source'] = req.source;
    } else {
      body['template_id'] = req.templateId;
    }
    const res = await axios.post(
      `${BASE_URL}/renders`,
      body,
      { headers: { Authorization: `Bearer ${config.creatomateApiKey}` } }
    );
    const data = res.data[0] ?? res.data;
    return { ok: true, renderId: data.id, status: data.status, url: data.url };
  } catch (err: unknown) {
    const e = err as { message?: string };
    logger.error(`[Creatomate] createRender error: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

export async function getRenderStatus(renderId: string): Promise<RenderResult> {
  if (!config.creatomateApiKey) {
    return { ok: true, renderId, status: 'mock', url: `https://mock.creatomate.com/renders/${renderId}.mp4`, mock: true };
  }
  try {
    const res = await axios.get(`${BASE_URL}/renders/${renderId}`, {
      headers: { Authorization: `Bearer ${config.creatomateApiKey}` },
    });
    return { ok: true, renderId: res.data.id, status: res.data.status, url: res.data.url };
  } catch (err: unknown) {
    const e = err as { message?: string };
    logger.error(`[Creatomate] getRenderStatus error: ${e.message}`);
    return { ok: false, error: e.message };
  }
}
