// Mock voice-clone provider.
// Real provider: clone the creator's voice from a consented sample (env VOICE_CLONE_PROVIDER).
// Consent is mandatory: cloning without it must fail closed.
export const name = 'voiceclone.mock';

const models = new Map();

export async function clone({ channelId, consent }) {
  if (!consent) {
    const err = new Error('consent_required');
    err.status = 400;
    throw err;
  }
  const id = 'vm_' + channelId + '_' + Math.random().toString(36).slice(2, 8);
  models.set(id, { id, channelId, status: 'active', createdAt: new Date().toISOString() });
  return models.get(id);
}

export function revoke(id) {
  const m = models.get(id);
  if (m) m.status = 'revoked';
  return m;
}
