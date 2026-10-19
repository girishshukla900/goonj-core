// AI Clip Factory: find the best moments in a long stream and cut them into
// shorts. Peaks come from live-chat activity — a real signal of what viewers
// reacted to. Clip metadata is stored in SQL; the caption files are written to
// disk. (Cutting the video itself needs ffmpeg.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as repo from '../../db/src/live_repo.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUT_DIR = path.resolve(HERE, '..', 'output');

const WINDOW = 10;
const CLIP_SECONDS = 30;
const LEAD_IN = 5;

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

function toVtt(clip, messages) {
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

const HOOKS = ['Best moment', 'Everyone reacted', 'You missed this', 'Peak clip', 'Must watch'];

export async function generateClips(stream, { count = 5 } = {}) {
  const messages = await repo.chatFor(stream.id);
  const peaks = detectPeaks(messages);
  const chosen = [];
  for (const peak of peaks) {
    const start = Math.max(0, peak.start - LEAD_IN);
    const end = start + CLIP_SECONDS;
    if (chosen.some((c) => !(end <= c.start || start >= c.end))) continue;
    chosen.push({ start, end, score: peak.count });
    if (chosen.length >= count) break;
  }

  const dir = path.join(OUTPUT_DIR, stream.id);
  fs.mkdirSync(dir, { recursive: true });

  const clips = chosen.map((c, i) => {
    const n = String(i + 1).padStart(2, '0');
    const clip = {
      id: repo.newId('clip'), stream_id: stream.id, index: i + 1,
      start: c.start, end: c.end, duration_s: c.end - c.start, score: c.score,
      lang: stream.source_lang, title: `${HOOKS[i % HOOKS.length]} — ${stream.title}`,
      hook: `${c.score} viewers reacted here`, captions: `${stream.id}/clip_${n}.vtt`,
    };
    fs.writeFileSync(path.join(dir, `clip_${n}.json`), JSON.stringify(clip, null, 2));
    fs.writeFileSync(path.join(dir, `clip_${n}.vtt`), toVtt(clip, messages));
    return clip;
  });

  fs.writeFileSync(path.join(dir, 'clips_manifest.json'),
    JSON.stringify({ stream_id: stream.id, title: stream.title, clips }, null, 2));
  await repo.saveClips(stream.id, clips);
  return clips;
}

export const clipsFor = (streamId) => repo.clipsFor(streamId);
