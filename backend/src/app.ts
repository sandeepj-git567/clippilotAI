import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import videoRoutes from './routes/video.routes';
import jobsRoutes from './routes/jobs.routes';
import highlightsRoutes from './routes/highlights.routes';
import clipsRoutes from './routes/clips.routes';
import youtubeRoutes from './routes/youtube.routes';
import publishingRoutes from './routes/publishing.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import backgroundMediaRoutes from './routes/background-media.routes';
import presetsRoutes from './routes/presets.routes';
import healthRoutes from './routes/health.routes';

import { authMiddleware } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// CORS
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Disable rate limiting for local development and polling dashboard
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true, // Always skip in local environment to prevent 429 blocks
});
app.use(limiter);

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'ClipPilot AI Backend',
    version: '1.0.0',
    status: 'running',
  });
});

// Protected routes (require auth)
app.use('/api/videos', authMiddleware, videoRoutes);
app.use('/api/jobs', authMiddleware, jobsRoutes);
app.use('/api/highlights', authMiddleware, highlightsRoutes);
app.use('/api/clips', authMiddleware, clipsRoutes);
app.use('/api/youtube', authMiddleware, youtubeRoutes);
app.use('/api/publishing', authMiddleware, publishingRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/background-media', authMiddleware, backgroundMediaRoutes);
app.use('/api/presets', authMiddleware, presetsRoutes);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
