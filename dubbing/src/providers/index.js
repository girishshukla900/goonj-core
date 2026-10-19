// Provider registry. Mocks are the default so the pipeline runs locally with
// no credentials; set ASR_PROVIDER / TRANSLATE_PROVIDER / TTS_PROVIDER /
// VOICE_CLONE_PROVIDER to "real" to use managed providers (not bundled).
import * as asr from './asr.mock.js';
import * as translate from './translate.mock.js';
import * as tts from './tts.synth.js';
import * as voiceclone from './voiceclone.mock.js';

function pick(mod, envKey) {
  const want = (process.env[envKey] || 'mock').toLowerCase();
  if (want === 'real') {
    throw new Error(`${envKey}=real is not bundled; implement the adapter with the same shape`);
  }
  return mod;
}

export const providers = {
  asr: pick(asr, 'ASR_PROVIDER'),
  translate: pick(translate, 'TRANSLATE_PROVIDER'),
  tts: pick(tts, 'TTS_PROVIDER'),
  voiceclone: pick(voiceclone, 'VOICE_CLONE_PROVIDER'),
};
