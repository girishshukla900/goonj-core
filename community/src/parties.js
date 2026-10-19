// Watch parties and members-only community posts. Stored in PostgreSQL.
import * as repo from '../../db/src/community_repo.js';
import { membershipOf } from './memberships.js';

export const createParty = (opts) => repo.createParty(opts);
export const rsvp = (partyId, userId) => repo.addRsvp(partyId, userId);
export const createPost = (opts) => repo.createPost(opts);

export async function postsFor(channel_id, { viewer_id } = {}) {
  const isMember = viewer_id ? !!(await membershipOf(viewer_id, channel_id)) : false;
  return repo.listPosts(channel_id, { membersOnlyVisible: isMember });
}
