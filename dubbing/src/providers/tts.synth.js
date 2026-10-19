// TTS provider: generates a real WAV per segment, pitched per language and voice.
// Real provider: neural TTS in the creator's cloned voice (env TTS_PROVIDER).
import { tone, toneFor } from '../audio.js';

export const name = 'tts.synth';

export async function synthesize({ text, lang, voiceModelId }) {
  const base = toneFor(lang);
  // Vary slightly by voice model so different creators sound different.
  const jitter = voiceModelId ? (hash(voiceModelId) % 30) - 15 : 0;
  const seconds = Math.max(1.2, Math.min(6, text.length / 18));
  return { samples: tone(seconds, base + jitter), lang };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
