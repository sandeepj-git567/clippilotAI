import { google } from 'googleapis';
import { prisma } from '../db/prisma';
import { youtubeOAuthService } from './youtube-oauth.service';
import { logger } from '../config/logger';

export class AnalyticsService {
  /**
   * Retrieves real YouTube performance metrics (views, likes, comments) for published Shorts.
   * Section 16: Never populate analytics with fabricated demo values.
   */
  async syncVideoAnalytics(publishedVideoId: string) {
    const published = await prisma.publishedVideo.findUnique({
      where: { id: publishedVideoId },
      include: { youtubeAccount: true }
    });

    if (!published || !published.youtubeAccount || !published.youtubeAccount.isConnected) {
      return null;
    }

    try {
      const auth = await youtubeOAuthService.getAuthenticatedClient(published.youtubeAccountId);
      const youtube = google.youtube({ version: 'v3', auth });

      const res = await youtube.videos.list({
        part: ['statistics', 'snippet'],
        id: [published.youtubeVideoId]
      });

      const videoItem = res.data.items?.[0];
      if (!videoItem || !videoItem.statistics) {
        logger.warn(`No YouTube statistics found for video ID: ${published.youtubeVideoId}`);
        return null;
      }

      const stats = videoItem.statistics;
      const views = parseInt(stats.viewCount || '0', 10);
      const likes = parseInt(stats.likeCount || '0', 10);
      const comments = parseInt(stats.commentCount || '0', 10);

      // Update PublishedVideo
      const updated = await prisma.publishedVideo.update({
        where: { id: publishedVideoId },
        data: {
          views,
          likes,
          comments,
          lastAnalyticsSyncAt: new Date(),
          rawAnalytics: stats as any
        }
      });

      // Record snapshot
      await prisma.analyticsSnapshot.create({
        data: {
          publishedVideoId,
          youtubeAccountId: published.youtubeAccountId,
          views,
          likes,
          comments
        }
      });

      return updated;
    } catch (err: any) {
      logger.error(`Error syncing analytics for video ${published.youtubeVideoId}: ${err.message}`);
      return null;
    }
  }

  async getDashboardAnalytics(userId?: string) {
    const publishedVideos = await prisma.publishedVideo.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 50
    });

    const totalPublished = publishedVideos.length;
    const totalViews = publishedVideos.reduce((sum, v) => sum + v.views, 0);
    const totalLikes = publishedVideos.reduce((sum, v) => sum + v.likes, 0);
    const totalComments = publishedVideos.reduce((sum, v) => sum + v.comments, 0);

    const successfulUploads = await prisma.clip.count({ where: { status: 'PUBLISHED' } });
    const failedUploads = await prisma.clip.count({ where: { status: 'FAILED' } });
    const totalAttempts = successfulUploads + failedUploads;
    const successRate = totalAttempts > 0 ? Math.round((successfulUploads / totalAttempts) * 100) : 100;

    return {
      totalPublished,
      totalViews,
      totalLikes,
      totalComments,
      successRate,
      successfulUploads,
      failedUploads,
      recentVideos: publishedVideos.slice(0, 10)
    };
  }
}

export const analyticsService = new AnalyticsService();
