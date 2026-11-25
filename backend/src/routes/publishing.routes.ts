import { Router } from 'express';
import { prisma } from '../db/prisma';
import { publishingScheduler } from '../services/publishing-scheduler.service';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/publishing - List publishing queue entries
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status as string;
    }

    const queueItems = await prisma.publishingQueue.findMany({
      where,
      orderBy: { scheduledTime: 'asc' },
      include: {
        clip: {
          select: {
            id: true,
            title: true,
            status: true,
            thumbnailPath: true,
            durationSec: true,
            sourceVideo: { select: { id: true, title: true } }
          }
        },
        youtubeAccount: {
          select: {
            id: true,
            channelTitle: true,
            channelThumbnail: true,
            channelCustomUrl: true
          }
        }
      }
    });

    res.json({ success: true, queue: queueItems });
  } catch (err) {
    next(err);
  }
});

// GET /api/publishing/published - List published videos
router.get('/published', async (req: AuthenticatedRequest, res, next) => {
  try {
    const publishedVideos = await prisma.publishedVideo.findMany({
      orderBy: { publishedAt: 'desc' },
      include: {
        clip: {
          select: {
            id: true,
            title: true,
            thumbnailPath: true,
            durationSec: true
          }
        },
        youtubeAccount: {
          select: {
            id: true,
            channelTitle: true,
            channelCustomUrl: true,
            channelThumbnail: true
          }
        },
        analyticsSnapshots: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    res.json({ success: true, publishedVideos });
  } catch (err) {
    next(err);
  }
});

// POST /api/publishing/process - Manually trigger queue processing
router.post('/process', async (req: AuthenticatedRequest, res, next) => {
  try {
    logger.info('Manual publishing queue processing triggered');
    await publishingScheduler.processPublishingQueue();
    res.json({ success: true, message: 'Publishing queue processed' });
  } catch (err) {
    next(err);
  }
});

export default router;
