import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://goonj:goonj@localhost:5432/goonj',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiry: process.env.JWT_EXPIRY || '30d',
  s3Bucket: process.env.S3_BUCKET || 'goonj-media-dev',
  uploadUrlTtl: Number(process.env.UPLOAD_URL_TTL || 900),

  // Media storage. `local` (default) keeps files on disk and needs no
  // credentials; `s3` targets an S3-compatible bucket and needs credentials.
  mediaProvider: process.env.MEDIA_PROVIDER || 'local',
  mediaDir: process.env.MEDIA_DIR || path.resolve(process.cwd(), '.media'),
  mediaSigningSecret: process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me',
  mediaUrlTtl: Number(process.env.MEDIA_URL_TTL || 3600),

  dubbingUrl: process.env.DUBBING_URL || '',
  paymentsUrl: process.env.PAYMENTS_URL || '',
  liveUrl: process.env.LIVE_URL || '',
  communityUrl: process.env.COMMUNITY_URL || '',
};
