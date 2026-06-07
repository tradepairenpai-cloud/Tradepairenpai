import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { searchVideos, searchPhotos } from '../lib/pexels';

export interface AssetInput {
  query: string;
  type?: 'video' | 'photo';
  count?: number;
}

export class AssetFinderAgent extends BaseAgent {
  name = 'asset-finder' as const;
  thaiLabel = 'เอเจนต์หา Asset (Pexels)';

  async run(input: unknown): Promise<AgentResult> {
    const { query, type = 'video', count = 5 } = input as AssetInput;
    this.setStatus('running', `searching ${type}: ${query}`);
    this.log('info', `Searching ${type}s for: ${query}`);

    const result = type === 'photo'
      ? await searchPhotos(query, count)
      : await searchVideos(query, count);

    if (!result.ok) {
      this.setStatus('failed', result.error || 'search failed');
      return { ok: false, output: null, error: result.error };
    }

    this.setStatus('completed', `found ${result.assets.length} ${type}s`);
    this.log('info', `Found ${result.assets.length} ${type}s${result.mock ? ' (mock)' : ''}`);
    return { ok: true, output: result.assets, mock: result.mock };
  }
}
