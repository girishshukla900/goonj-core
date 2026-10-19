// Watch parties and members-only community posts.
import { store, newId } from './store.js';
import { membershipOf } from './memberships.js';

export function createParty({ channel_id, video_id, title, starts_at }) {
  const party = {
    id: newId('party'), channel_id, video_id: video_id || null,
    title: title || 'Watch party',
    starts_at: starts_at || new Date(Date.now() + 3600 * 1000).toISOString(),
    rsvps: [], created_at: new Date().toISOString(),
  };
  store.parties.set(party.id, party);
  return party;
}

export function rsvp(party, user_id) {
  if (!party.rsvps.includes(user_id)) party.rsvps.push(user_id);
  return party;
}

export function createPost({ channel_id, author_id, text, members_only }) {
  const post = {
    id: newId('post'), channel_id, author_id: author_id || 'creator',
    text: String(text || ''), members_only: !!members_only,
    created_at: new Date().toISOString(),
  };
  const list = store.posts.get(channel_id) || [];
  list.unshift(post);
  store.posts.set(channel_id, list);
  return post;
}

export function postsFor(channel_id, { viewer_id } = {}) {
  const list = store.posts.get(channel_id) || [];
  const isMember = viewer_id ? !!membershipOf(viewer_id, channel_id) : false;
  return isMember ? list : list.filter((p) => !p.members_only);
}
