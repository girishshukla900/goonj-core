// AI Clip Factory: find the best moments in a long stream and cut them into
// shorts. Peaks are detected from live-chat activity — a real signal of what
// viewers reacted to. (Video cutting itself needs ffmpeg; this produces the
// clip plan, titles, hooks and captions that drive it.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store, newId } from './store.js';
import { chatFor } from './chat.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_DIR = path.resolve(HERE, '..', 'output');

const WINDOW = 10;      // seconds per activity bucket
const CLIP_SECONDS = 30;
const LEAD_IN = 5;

/** Bucket chat activity into windows; return peaks sorted by activity. */
export function detectPeaks(messages, { windowSec = WINDOW } = {}) {
  const buckets = new Map();
  for (const m of messages) {
    const b = Math.floor(m.at / windowSec) * windowSec;
    buckets.set(b, (buckets.get(b) || 0) + 1);
  }
  return [...buckets.entries()]
    .map(([start, count]) => ({ start, count }))
    .sort((a, b) => b.count - a.count || a.start - b.start);
}

function toVtt(streamId, clip, messages) {
  const ts = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    const ms = String(Math.round((s % 1) * 1000)).padStart(3, '0');
    return `00:${mm}:${ss}.${ms}`;
  };
  let out = 'WEBVTT\n\n';
  const inWindow = messages.filter((m) => m.at >= clip.start && m.at < clip.end);
  inWindow.forEach((m, i) => {
    const rel = Math.max(0, m.at - clip.start);
    out += `${i + 1}\n${ts(rel)} --> ${ts(rel + 2.5)}\n${m.user}: ${m.text}\n\n`;
  });
  if (inWindow.length === 0) out += `1\n${ts(0)} --> ${ts(3)}\n[clip]\n\n`;
  return out;
}

function titleFor(stream, i, peak) {
  const hooks = ['Best moment', 'Everyone reacted', 'You missed this', 'Peak clip', 'Must watch'];
  return `${hooks[i % hooks.length]} — ${stream.title}`;
}

/** Generate up to `count` non-overlapping clips from the stream's chat peaks. */
export function generateClips(stream, { count = 5 } = {}) {
  const messages = chatFor(stream.id);
  const peaks = detectPeaks(messages);
  const chosen = [];
  for (const peak of peaks) {
    const start = Math.max(0, peak.start - LEAD_IN);
    const end = start + CLIP_SECONDS;
    if (chosen.some((c) => !(end <= c.start || start >= c.end))) continue; // no overlap
    chosen.push({ start, end, score: peak.count });
    if (chosen.length >= count) break;
  }

  const dir = path.join(OUTPUT_DIR, stream.id);
  fs.mkdirSync(dir, { recursive: true });

  const clips = chosen.map((c, i) => {
    const n = String(i + 1).padStart(2, '0');
    const clip = {
      id: newId('clip'),
      stream_id: stream.id,
      index: i + 1,
      start: c.start,
      end: c.end,
      duration_s: c.end - c.start,
      score: c.score,                       // chat messages in the peak window
      lang: stream.source_lang,
      title: titleFor(stream, i, c),
      hook: `${c.score} viewers reacted here`,
      captions: `${stream.id}/clip_${n}.vtt`,
      created_at: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, `clip_${n}.json`), JSON.stringify(clip, null, 2));
    fs.writeFileSync(path.join(dir, `clip_${n}.vtt`), toVtt(stream.id, clip, messages));
    return clip;
  });

  const manifest = { stream_id: stream.id, title: stream.title, clips };
  fs.writeFileSync(path.join(dir, 'clips_manifest.json'), JSON.stringify(manifest, null, 2));
  store.clips.set(stream.id, clips);
  return clips;
}

export function clipsFor(streamId) {
  return store.clips.get(streamId) || [];
}
