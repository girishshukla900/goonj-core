// In-memory store for Phase 1. Redis/Postgres swap-in behind the same shape.
export const store = {
  jobs: new Map(),          // job_id -> job
  voiceModels: new Map(),   // voice_model_id -> model
  byChannel: new Map(),     // channel_id -> [voice_model_id]
  tracks: new Map(),        // video_id -> [track]
};

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}
