import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/errors.js';
import healthRouter from './routes/health.js';
import imageRouter from './routes/image.js';
import catalogRouter from './routes/catalog.js';
import streamRouter from './routes/stream.js';
import sitemapRouter from './routes/sitemap.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import billingRouter from './routes/billing.js';
import downloadRouter from './routes/download.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, max: 1000, standardHeaders: true, legacyHeaders: false })
  );

  app.use('/api/health', healthRouter);
  app.use('/api/image', imageRouter);
  app.use('/api/stream', streamRouter);
  app.use('/api', catalogRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/download', downloadRouter);
  app.use(sitemapRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
