// Simulcast: one stream, many destinations. Goonj becomes the control room,
// not a walled garden — the creator keeps streaming everywhere else too.
import { newId } from './store.js';

export const DESTINATIONS = ['goonj', 'youtube', 'instagram', 'twitch'];

const LABEL = {
  goonj: 'Goonj', youtube: 'YouTube', instagram: 'Instagram', twitch: 'Twitch',
};

export function createStream({ channel_id, title, source_lang, destinations }) {
  const wanted = (destinations && destinations.length ? destinations : DESTINATIONS)
    .filter((d) => DESTINATIONS.includes(d));
  return {
    id: newId('str'),
    channel_id,
    title: title || 'Untitled live',
    source_lang: source_lang || 'hi',
    status: 'created',                      // created | live | ended
    ingest_key: newId('ingest'),
    destinations: wanted.map((name) => ({
      name, label: LABEL[name], status: 'configured', rtmp: `rtmp://ingest.goonj.dev/${name}`,
    })),
    started_at: null,
    created_at: new Date().toISOString(),
  };
}

export function startStream(stream) {
  stream.status = 'live';
  stream.started_at = new Date().toISOString();
  for (const d of stream.destinations) d.status = 'live';
  return stream;
}

export function stopStream(stream) {
  stream.status = 'ended';
  for (const d of stream.destinations) d.status = 'ended';
  return stream;
}
