// Seed a small demo dataset (two creators, two videos).
import { createUser, createChannel, insertVideo, publishVideo } from './repo.js';

export async function seedDemo() {
  const u = await createUser({ phone: '9000000001', role: 'creator' });
  const ch = await createChannel({ user_id: u.id, handle: 'meera', name: 'Meera Cooks', language: 'hi', region: 'Delhi' });
  const v = await insertVideo({ channel_id: ch.id, title: 'Rajma Chawal', source_lang: 'hi' });
  await publishVideo(v.id);

  const u2 = await createUser({ phone: '9000000002', role: 'creator' });
  const ch2 = await createChannel({ user_id: u2.id, handle: 'thambi', name: 'Tamil Tech Thambi', language: 'ta', region: 'Chennai' });
  const v2 = await insertVideo({ channel_id: ch2.id, title: 'Best budget phones', source_lang: 'ta' });
  await publishVideo(v2.id);

  return { channels: [ch.id, ch2.id], videos: [v.id, v2.id] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo().then((r) => console.log('seeded', r));
}
