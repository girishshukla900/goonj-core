# Goonj dubbing service (Phase 1)

Runs the AI dubbing pipeline that is Goonj's wedge: one video, many Indian
languages, in the creator's own voice.

Zero dependencies (Node `node:http` + `node:fs` only). Job, voice-model and
track state live in **PostgreSQL** (`db/src/dubbing_repo.js`); the audio and
caption files are written to disk.

## Pipeline
```
ASR -> translate -> voice clone -> TTS -> align -> mix -> publish
```
Each job produces, per target language:
- `dub_<lang>.wav` — the dubbed audio track (real 16-bit PCM WAV)
- `dub_<lang>.vtt` — translated subtitles with timings
- `manifest.json` — the list of tracks for the video

## Run
```bash
cd dubbing
npm test        # end-to-end test: dubs one video into 3 languages, 15 assertions
npm start       # http://localhost:4100
```

## HTTP API
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness + queue depth |
| POST | `/voice-models` | Create a voice model. **`consent: true` is required** |
| POST | `/dub` | Queue dubbing for `target_langs` |
| GET | `/jobs` , `/jobs/:id` | Job status and progress |
| GET | `/tracks/:video_id` | Tracks produced for a video |
| GET | `/outputs/<path>` | Download generated audio / subtitles |

## Providers
Providers sit behind a fixed interface so real services drop in without
touching the pipeline. Defaults are local and credential-free:

| Stage | Default | Swap with (env) |
|---|---|---|
| ASR | `asr.mock` | `ASR_PROVIDER=real` |
| Translate | `translate.mock` | `TRANSLATE_PROVIDER=real` |
| TTS | `tts.synth` (writes real WAVs) | `TTS_PROVIDER=real` |
| Voice clone | `voiceclone.mock` | `VOICE_CLONE_PROVIDER=real` |

Setting a provider to `real` without implementing its adapter fails loudly —
the service never silently pretends to dub.

## Consent
Voice cloning fails closed: a voice model cannot be created without
`consent: true`. The model belongs to the creator and is revocable.
