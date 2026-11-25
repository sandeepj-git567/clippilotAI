import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { aiClient } from '../services/ai-client.service';
import { config } from '../config';
import { logger } from '../config/logger';

const router = Router();

// GET /api/health - Return service status, DB ping, Redis ping, AI engine health
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // --- DB ping ---
  let dbStatus: 'up' | 'down' = 'down';
  let dbError: string | undefined;
  try {
    await (prisma as any).$queryRaw`SELECT 1`;
    dbStatus = 'up';
  } catch (err: any) {
    dbError = err.message;
    logger.warn(`Health check: DB ping failed: ${err.message}`);
  }

  // --- Redis ping ---
  let redisStatus: 'up' | 'down' = 'down';
  let redisError: string | undefined;
  try {
    // Dynamically import ioredis to ping without coupling health to queue
    const { default: Redis } = await import('ioredis');
    const redisClient = new Redis(config.redisUrl, {
      connectTimeout: 3000,
      lazyConnect: true
    });
    await redisClient.connect();
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      redisStatus = 'up';
    }
    await redisClient.quit();
  } catch (err: any) {
    redisError = err.message;
    logger.warn(`Health check: Redis ping failed: ${err.message}`);
  }

  // --- AI Engine health ---
  let aiStatus: 'up' | 'down' = 'down';
  let aiData: any = null;
  let aiError: string | undefined;
  try {
    aiData = await aiClient.checkHealth();
    if (aiData && aiData.status !== 'down') {
      aiStatus = 'up';
    } else {
      aiError = aiData?.error;
    }
  } catch (err: any) {
    aiError = err.message;
    logger.warn(`Health check: AI engine health call failed: ${err.message}`);
  }

  const allUp = dbStatus === 'up' && redisStatus === 'up' && aiStatus === 'up';
  const responseTimeMs = Date.now() - startTime;

  const payload = {
    success: true,
    status: allUp ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    responseTimeMs,
    version: process.env.npm_package_version || '1.0.0',
    environment: config.env,
    services: {
      database: {
        status: dbStatus,
        ...(dbError ? { error: dbError } : {})
      },
      redis: {
        status: redisStatus,
        url: config.redisUrl.replace(/\/\/.*@/, '//***@'), // hide credentials
        ...(redisError ? { error: redisError } : {})
      },
      aiEngine: {
        status: aiStatus,
        url: config.aiEngineUrl,
        ...(aiData && aiStatus === 'up' ? { details: aiData } : {}),
        ...(aiError ? { error: aiError } : {})
      }
    }
  };

  // Return 200 even when degraded so load balancers don't drop the instance;
  // the `status` field tells clients the real picture.
  res.status(200).json(payload);
});

export default router;
