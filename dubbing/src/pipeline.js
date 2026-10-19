// The AI dubbing pipeline: ASR -> translate -> voice clone -> TTS -> align -> mix -> publish.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWav, SAMPLE_RATE } from './audio.js';
import { providers } from './providers/index.js';
import { mixTrack } from './providers/mix.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_DIR = path.resolve(HERE, '..', 'output');

export const STEPS = ['asr', 'translate', 'voice_clone', 'tts', 'align', 'mix', 'publish'];

function toVtt(segments) {
  const ts = (s) => {
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    const ms = String(Math.round((s % 1) * 1000)).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };
  let out = 'WEBVTT\n\n';
  segments.forEach((s, i) => {
    out += `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.text}\n\n`;
  });
  return out;
}

/**
 * Run one dubbing job for a single target language.
 * @param {object} job {video_id, source_lang, target_lang, voice_model_id}
 * @param {(step:string, pct:number)=>void} [onStep]
 */
export async function runDubJob(job, onStep = () => {}) {
  // 1. Transcribe the source audio (ASR + diarisation).
  onStep('asr', 10);
  const transcript = await providers.asr.transcribe({ sourceLang: job.source_lang });

  // 2. Translate into the target language (reviewable draft).
  onStep('translate', 28);
  const translated = await providers.translate.translate({
    segments: transcript, targetLang: job.target_lang,
  });

  // 3. Voice model must exist and be consented.
  onStep('voice_clone', 42);
  if (!job.voice_model_id) throw new Error('voice_model_required');

  // 4. Synthesise each segment in the cloned voice.
  onStep('tts', 58);
  const segs = [];
  for (const s of translated) {
    const { samples } = await providers.tts.synthesize({
      text: s.text, lang: job.target_lang, voiceModelId: job.voice_model_id,
    });
    segs.push({ start: s.start, end: s.end, samples });
  }

  // 5. Align segments to the original timeline, then 6. mix over the bed.
  onStep('align', 72);
  const pcm = await mixTrack({ segments: segs, sampleRate: SAMPLE_RATE });
  onStep('mix', 86);

  // 7. Publish: write the audio track, subtitles, and update the manifest.
  const dir = path.join(OUTPUT_DIR, job.video_id);
  fs.mkdirSync(dir, { recursive: true });
  const wavName = `dub_${job.target_lang}.wav`;
  const vttName = `dub_${job.target_lang}.vtt`;
  fs.writeFileSync(path.join(dir, wavName), encodeWav(pcm));
  fs.writeFileSync(path.join(dir, vttName), toVtt(translated));

  const track = {
    video_id: job.video_id, lang: job.target_lang, kind: 'dub_audio',
    audio: `${job.video_id}/${wavName}`, subtitle: `${job.video_id}/${vttName}`,
    voice_model_id: job.voice_model_id,
    duration_s: +(pcm.length / SAMPLE_RATE).toFixed(2),
    bytes: fs.statSync(path.join(dir, wavName)).size,
    created_at: new Date().toISOString(),
  };
  writeManifest(job.video_id, track);
  onStep('publish', 100);
  return track;
}

export function writeManifest(videoId, track) {
  const dir = path.join(OUTPUT_DIR, videoId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'manifest.json');
  let manifest = { video_id: videoId, tracks: [] };
  if (fs.existsSync(file)) manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.tracks = manifest.tracks.filter((t) => t.lang !== track.lang);
  manifest.tracks.push(track);
  manifest.tracks.sort((a, b) => a.lang.localeCompare(b.lang));
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return manifest;
}
