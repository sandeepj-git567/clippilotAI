import { Router } from 'express';
import { analyticsService } from '../services/analytics.service';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/analytics - Return dashboard analytics
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const analytics = await analyticsService.getDashboardAnalytics(userId);
    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
});

// POST /api/analytics/sync/:publishedVideoId - Trigger analytics sync for a published video
router.post('/sync/:publishedVideoId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const publishedVideoId = req.params.publishedVideoId as string;

    logger.info(`Triggering analytics sync for published video: ${publishedVideoId}`);
    const updated = await analyticsService.syncVideoAnalytics(publishedVideoId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Published video not found or YouTube account not connected'
      });
    }

    res.json({ success: true, publishedVideo: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
