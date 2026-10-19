# Goonj live service (Phase 3)

Live streaming with **simulcast**, moderated multilingual **chat**, interactive
**polls**, and the **AI Clip Factory**. Zero dependencies (Node `node:http`).

## Simulcast
One stream fans out to Goonj + YouTube + Instagram + Twitch. Goonj becomes the
creator's control room, not a walled garden — the creator keeps streaming
everywhere else, and the risk of switching is zero.

## AI Clip Factory
Finds the best moments in a long stream and cuts them into shorts. Peaks are
detected from **live-chat activity** — a real signal of what viewers reacted
to. For each clip it writes:
- `clip_NN.json` — timings, score (reactions), title, hook
- `clip_NN.vtt` — captions from the chat in that window
- `clips_manifest.json` — all clips for the stream

Cutting the actual video needs ffmpeg; this service produces the clip plan,
titles, hooks and captions that drive the cut.

## Run
```bash
cd live
npm test        # 19 assertions: simulcast, moderation, polls, clip factory
npm start       # http://localhost:4300
```

## HTTP API
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/streams` | Create a stream + destinations |
| POST | `/streams/:id/start` , `/stop` | Go live / end |
| GET | `/streams/:id` | Stream + destination status |
| POST/GET | `/streams/:id/chat` | Post / read chat (moderated) |
| POST | `/streams/:id/polls` , `/polls/:id/vote` | Interactive polls |
| POST | `/streams/:id/clips` | Generate shorts from chat peaks |
| GET | `/streams/:id/clips` | Clips for a stream |
| GET | `/clips/<path>` | Download clip metadata / captions |

## Not wired yet
The RTMP fan-out is modelled (destination state), not actually pushed to
YouTube/Instagram/Twitch. Real destinations need each platform's streaming API.
