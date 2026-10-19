// Pure-Node audio helpers: no external binaries, no native deps.
// Produces real 16-bit PCM WAV data so the pipeline writes playable files.

const SAMPLE_RATE = 16000;

// Per-language base frequency (Hz) so each language track is audibly distinct.
const LANG_TONE = {
  hi: 220, ta: 247, bn: 262, te: 277, mr: 294,
  pa: 311, kn: 330, bho: 349, en: 196,
};

export function toneFor(lang) {
  return LANG_TONE[lang] || 240;
}

/** A short voiced-like tone segment with fade in/out. */
export function tone(durationSec, freq, amp = 0.25) {
  const n = Math.max(1, Math.round(durationSec * SAMPLE_RATE));
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, i / 240, (n - i) / 240);
    out[i] = Math.round(amp * env * 32767 * Math.sin(2 * Math.PI * freq * t));
  }
  return out;
}

export function silence(durationSec) {
  return new Int16Array(Math.max(1, Math.round(durationSec * SAMPLE_RATE)));
}

export function concatInt16(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/** Encode Int16 PCM samples as a mono WAV buffer. */
export function encodeWav(int16) {
  const numSamples = int16.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);                 // PCM
  buffer.writeUInt16LE(1, 22);                 // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);   // byte rate
  buffer.writeUInt16LE(2, 32);                 // block align
  buffer.writeUInt16LE(16, 34);                // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) buffer.writeInt16LE(int16[i], 44 + i * 2);
  return buffer;
}

export { SAMPLE_RATE };
