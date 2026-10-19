import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import feedRoutes from './routes/feed.js';
import earningsRoutes from './routes/earnings.js';
import liveRoutes from './routes/live.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) =>
    res.json({ ok: true, service: 'goonj-api', version: '0.1.0' }));

  app.use('/v1/auth', authRoutes);
  app.use('/v1/videos', videoRoutes);
  app.use('/v1/feed', feedRoutes);
  app.use('/v1/earnings', earningsRoutes);
  app.use('/v1/live', liveRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'internal_error' });
  });

  return app;
}
