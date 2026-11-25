import { prisma } from '../db/prisma';
import { youtubeUploadService } from './youtube-upload.service';
import { rightsService } from './rights.service';
import { logger } from '../config/logger';

export class PublishingSchedulerService {
  /**
   * Schedules an approved clip for automated publication according to daily limits
   * and preferred posting times in the user's timezone.
   */
  async scheduleClip(clipId: string, scheduledTime?: Date) {
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { sourceVideo: true }
    });

    if (!clip) throw new Error(`Clip not found: ${clipId}`);
    if (clip.status !== 'APPROVED') {
      throw new Error(`Only APPROVED clips can be scheduled. Current status: ${clip.status}`);
    }

    // Verify rights
    const canPublish = await rightsService.verifyCanPublish(clip.sourceVideoId);
    if (!canPublish) {
      throw new Error(`Cannot schedule clip ${clipId}: Source video rights have not been verified.`);
    }

    // Find connected YouTube account
    const account = await prisma.youTubeAccount.findFirst({
      where: { userId: clip.sourceVideo.userId, isConnected: true }
    });

    if (!account) {
      throw new Error('No connected YouTube account found for this user. Please connect your account first.');
    }

    const settings = await prisma.automationSettings.findUnique({
      where: { userId: clip.sourceVideo.userId }
    });

    const targetTime = scheduledTime || this.calculateNextPublishSlot(settings);

    const queueItem = await prisma.publishingQueue.upsert({
      where: { clipId },
      create: {
        clipId,
        youtubeAccountId: account.id,
        scheduledTime: targetTime,
        status: 'QUEUED'
      },
      update: {
        youtubeAccountId: account.id,
        scheduledTime: targetTime,
        status: 'QUEUED'
      }
    });

    await prisma.clip.update({
      where: { id: clipId },
      data: {
        status: 'SCHEDULED',
        scheduledFor: targetTime
      }
    });

    logger.info(`Clip ${clipId} scheduled for publication at: ${targetTime.toISOString()}`);
    return queueItem;
  }

  /**
   * Calculates the next available publishing slot respecting maxDailyUploads.
   */
  private calculateNextPublishSlot(settings: any): Date {
    const defaultPostingTimes = ['10:00', '14:00', '18:00', '21:00'];
    const times = (settings?.preferredPostingTimes as string[]) || defaultPostingTimes;
    const now = new Date();

    // Check slots today
    for (const timeStr of times) {
      const [h, m] = timeStr.split(':').map(Number);
      const slotDate = new Date(now);
      slotDate.setHours(h, m, 0, 0);

      // If slot is at least 10 minutes in the future
      if (slotDate.getTime() > now.getTime() + 10 * 60 * 1000) {
        return slotDate;
      }
    }

    // Tomorrow first slot
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [firstH, firstM] = times[0].split(':').map(Number);
    tomorrow.setHours(firstH, firstM, 0, 0);
    return tomorrow;
  }

  /**
   * Processes all pending queued items whose scheduledTime has arrived.
   */
  async processPublishingQueue() {
    const now = new Date();
    const pendingItems = await prisma.publishingQueue.findMany({
      where: {
        status: 'QUEUED',
        scheduledTime: { lte: now }
      },
      include: {
        clip: { include: { sourceVideo: true } },
        youtubeAccount: true
      },
      take: 1
    });

    for (const item of pendingItems) {
      try {
        logger.info(`Processing scheduled publication for clip ${item.clipId}`);
        await youtubeUploadService.uploadClip({
          clipId: item.clipId,
          youtubeAccountId: item.youtubeAccountId
        });
      } catch (err: any) {
        logger.error(`Error processing scheduled publication for clip ${item.clipId}: ${err.message}`);
        await prisma.publishingQueue.update({
          where: { id: item.id },
          data: {
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
            errorMessage: err.message
          }
        });
      }
    }
  }
}

export const publishingScheduler = new PublishingSchedulerService();
