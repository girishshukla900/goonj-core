// Simulcast: one stream, many destinations. Persisted in PostgreSQL.
import * as repo from '../../db/src/live_repo.js';

export const DESTINATIONS = repo.DESTINATIONS;
export const createStream = (opts) => repo.createStream(opts);
export const startStream = (id) => repo.setStreamStatus(id, 'live');
export const stopStream = (id) => repo.setStreamStatus(id, 'ended');
