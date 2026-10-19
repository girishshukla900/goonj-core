// Mixer: lays each language's segments on the timeline and writes a WAV track.
// Real provider: mix TTS over the preserved music/SFX bed.
import { concatInt16, silence } from '../audio.js';

export async function mixTrack({ segments, sampleRate = 16000 }) {
  const chunks = [];
  let cursor = 0;
  for (const seg of segments) {
    const gap = Math.max(0, seg.start - cursor);
    if (gap > 0) chunks.push(silence(gap));
    chunks.push(seg.samples);
    cursor = seg.start + seg.samples.length / sampleRate;
  }
  return concatInt16(chunks);
}
