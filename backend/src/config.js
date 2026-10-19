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
  dubbingUrl: process.env.DUBBING_URL || '',
  paymentsUrl: process.env.PAYMENTS_URL || '',
  liveUrl: process.env.LIVE_URL || '',
};
