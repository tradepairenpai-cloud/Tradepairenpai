import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { logger } from './logger';

const BASE_URL = 'https://api.elevenlabs.io/v1';

export const VOICES = {
  thai_female: 'XB0fDUnXU5powFXDhCwa',
  english_male: 'TxGEqnHWrfWFTfGW9XjX',
};

export interface VoiceoverResult {
  ok: boolean;
  filePath?: string;
  error?: string;
  mock?: boolean;
}

export async function generateVoiceover(
  text: string,
  voiceId = VOICES.thai_female,
  outputFileName?: string
): Promise<VoiceoverResult> {
  const fileName = outputFileName || `vo-${Date.now()}.mp3`;
  const filePath = path.join(config.outputDir, fileName);

  if (!config.elevenlabsApiKey) {
    logger.warn('[ElevenLabs] No API key — writing mock voiceover file');
    fs.writeFileSync(filePath, `MOCK VOICEOVER: ${text}`);
    return { ok: true, filePath, mock: true };
  }

  try {
    const res = await axios.post(
      `${BASE_URL}/text-to-speech/${voiceId}`,
      { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
      {
        headers: { 'xi-api-key': config.elevenlabsApiKey, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
      }
    );
    fs.writeFileSync(filePath, Buffer.from(res.data));
    logger.info(`[ElevenLabs] Saved voiceover: ${filePath}`);
    return { ok: true, filePath };
  } catch (err: unknown) {
    const e = err as { response?: { status?: number }; message?: string };
    if (e.response?.status === 402) {
      logger.warn('[ElevenLabs] Quota exceeded (402) — writing mock voiceover file');
      fs.writeFileSync(filePath, `MOCK VOICEOVER: ${text}`);
      return { ok: true, filePath, mock: true };
    }
    logger.error(`[ElevenLabs] generateVoiceover error: ${e.message}`);
    return { ok: false, error: e.message };
  }
}
