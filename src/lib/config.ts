import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.startsWith('your_')) return '';
  return val;
}

export const config = {
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  creatomateApiKey: requireEnv('CREATOMATE_API_KEY'),
  elevenlabsApiKey: requireEnv('ELEVENLABS_API_KEY'),
  pexelsApiKey: requireEnv('PEXELS_API_KEY'),
  appPort: parseInt(process.env['APP_PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  // DEMO_MODE=true (default) allows mock render URLs without failing QA.
  // Set DEMO_MODE=false and provide a real CREATOMATE_API_KEY for production.
  demoMode: process.env['DEMO_MODE'] !== 'false',
  outputDir: path.resolve(process.env['OUTPUT_DIR'] || './outputs'),
  assetDir: path.resolve(process.env['ASSET_DIR'] || './assets'),
  logLevel: process.env['LOG_LEVEL'] || 'info',
};

export function mockVideoAllowed(): boolean {
  return config.demoMode || config.nodeEnv !== 'production';
}

export function ensureDirs() {
  [config.outputDir, config.assetDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

export function checkApiKeys(): Record<string, boolean> {
  return {
    ANTHROPIC_API_KEY: !!config.anthropicApiKey,
    OPENAI_API_KEY: !!config.openaiApiKey,
    GEMINI_API_KEY: !!config.geminiApiKey,
    CREATOMATE_API_KEY: !!config.creatomateApiKey,
    ELEVENLABS_API_KEY: !!config.elevenlabsApiKey,
    PEXELS_API_KEY: !!config.pexelsApiKey,
  };
}
