import { BaseAgent } from './base-agent';
import { AgentResult } from './types';
import { generateVoiceover, VOICES } from '../lib/elevenlabs';

export interface VoiceoverInput {
  text: string;
  language?: 'thai' | 'english';
  fileName?: string;
}

export class VoiceoverAgent extends BaseAgent {
  name = 'voiceover' as const;
  thaiLabel = 'เอเจนต์สร้างเสียง (ElevenLabs)';

  async run(input: unknown): Promise<AgentResult> {
    const { text, language = 'thai', fileName } = input as VoiceoverInput;
    this.setStatus('running', `generating ${language} voiceover`);
    this.log('info', `Generating voiceover (${language}): ${text.slice(0, 60)}`);

    const voiceId = language === 'thai' ? VOICES.thai_female : VOICES.english_male;
    const result = await generateVoiceover(text, voiceId, fileName);

    if (!result.ok) {
      this.setStatus('failed', result.error || 'voiceover failed');
      return { ok: false, output: null, error: result.error };
    }

    this.setStatus('completed', `saved: ${result.filePath}`);
    this.log('info', `Voiceover saved: ${result.filePath}${result.mock ? ' (mock)' : ''}`);
    return { ok: true, output: { filePath: result.filePath }, mock: result.mock };
  }
}
