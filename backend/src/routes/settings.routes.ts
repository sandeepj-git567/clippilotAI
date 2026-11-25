import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/settings - Return automation settings for current user
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    let settings = await prisma.automationSettings.findUnique({
      where: { userId }
    });

    // Auto-create default settings if none exist
    if (!settings) {
      settings = await prisma.automationSettings.create({
        data: {
          userId,
          autoPublishEnabled: false,
          maxDailyUploads: 4,
          preferredPostingTimes: ['10:00', '14:00', '18:00', '21:00'],
          timezone: 'Asia/Kolkata',
          paused: false
        }
      });
      logger.info(`Created default automation settings for user ${userId}`);
    }

    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings - Update automation settings
router.patch('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const {
      autoPublishEnabled,
      maxDailyUploads,
      preferredPostingTimes,
      timezone,
      paused
    } = req.body;

    // Build update payload with only provided fields
    const updateData: Record<string, any> = {};
    if (autoPublishEnabled !== undefined) updateData.autoPublishEnabled = autoPublishEnabled;
    if (maxDailyUploads !== undefined) updateData.maxDailyUploads = parseInt(String(maxDailyUploads), 10);
    if (preferredPostingTimes !== undefined) updateData.preferredPostingTimes = preferredPostingTimes;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (paused !== undefined) updateData.paused = paused;

    const settings = await prisma.automationSettings.upsert({
      where: { userId },
      create: {
        userId,
        autoPublishEnabled: autoPublishEnabled ?? false,
        maxDailyUploads: maxDailyUploads ?? 4,
        preferredPostingTimes: preferredPostingTimes ?? ['10:00', '14:00', '18:00', '21:00'],
        timezone: timezone ?? 'Asia/Kolkata',
        paused: paused ?? false,
        ...updateData
      },
      update: updateData
    });

    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

export default router;
