import fs from 'fs';
import { google } from 'googleapis';
import { prisma } from '../db/prisma';
import { youtubeOAuthService } from './youtube-oauth.service';
import { logger } from '../config/logger';

export interface UploadClipParams {
  clipId: string;
  youtubeAccountId: string;
  privacyStatus?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
  scheduledPublishTime?: Date;
}

export class YouTubeUploadService {
  /**
   * Uploads an approved 9:16 vertical video clip to YouTube Shorts using YouTube Data API v3.
   * Handles resumable upload, metadata tags, duplicate prevention, and response verification.
   */
  async uploadClip(params: UploadClipParams) {
    const { clipId, youtubeAccountId, privacyStatus = 'PUBLIC', scheduledPublishTime } = params;

    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { sourceVideo: true, highlight: true }
    });

    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }

    if (!clip.outputFilePath || !fs.existsSync(clip.outputFilePath)) {
      throw new Error(`Rendered video file does not exist on disk: ${clip.outputFilePath}`);
    }

    if (!clip.qualityChecked) {
      throw new Error(`Clip ${clipId} has not passed video quality checks.`);
    }

    // Check duplicate: prevent re-uploading an already published clip
    if (clip.youtubeVideoId) {
      const existing = await prisma.publishedVideo.findUnique({
        where: { youtubeVideoId: clip.youtubeVideoId }
      });
      if (existing) {
        logger.warn(`Clip ${clipId} has already been published as YouTube Video: ${clip.youtubeVideoId}`);
        return existing;
      }
    }

    logger.info(`Starting YouTube upload for clip ${clipId} ("${clip.title}") to account ${youtubeAccountId}`);

    // Update clip status
    await prisma.clip.update({
      where: { id: clipId },
      data: { status: 'UPLOADING' }
    });

    try {
      const auth = await youtubeOAuthService.getAuthenticatedClient(youtubeAccountId);
      const youtube = google.youtube({ version: 'v3', auth });

      // Build tags
      const rawTags = (clip.hashtags || []).map(t => t.replace('#', ''));
      const tags = Array.from(new Set(['Shorts', 'YouTubeShorts', ...rawTags]));

      // Format title: ensure it includes #Shorts for vertical recognition
      let finalTitle = clip.title.trim();
      if (!finalTitle.toLowerCase().includes('#shorts')) {
        finalTitle = `${finalTitle} #Shorts`;
      }
      if (finalTitle.length > 100) {
        finalTitle = finalTitle.substring(0, 95) + '...';
      }

      // Build status object
      const statusObj: any = {
        privacyStatus: scheduledPublishTime ? 'PRIVATE' : privacyStatus.toLowerCase(),
        selfDeclaredMadeForKids: false
      };

      if (scheduledPublishTime) {
        statusObj.publishAt = scheduledPublishTime.toISOString();
      }

      const fileSize = fs.statSync(clip.outputFilePath).size;
      const mediaStream = fs.createReadStream(clip.outputFilePath);

      // Perform resumable upload
      const uploadRes: any = await (youtube.videos.insert as any)(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: finalTitle,
              description: clip.description,
              tags: tags.slice(0, 30),
              categoryId: '24' // Entertainment
            },
            status: statusObj
          },
          media: {
            body: mediaStream
          }
        }
      );

      const uploadedVideo = uploadRes.data;
      if (!uploadedVideo.id) {
        throw new Error('YouTube upload completed but no video ID was returned.');
      }

      const youtubeVideoId = uploadedVideo.id;
      const youtubeUrl = `https://youtube.com/shorts/${youtubeVideoId}`;

      logger.info(`YouTube upload successful! Video ID: ${youtubeVideoId}, URL: ${youtubeUrl}`);

      // Save PublishedVideo record & update clip
      const published = await prisma.$transaction(async (tx) => {
        await tx.clip.update({
          where: { id: clipId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            youtubeVideoId,
            youtubeVideoUrl: youtubeUrl
          }
        });

        const publishedRecord = await tx.publishedVideo.create({
          data: {
            clipId,
            youtubeAccountId,
            youtubeVideoId,
            youtubeUrl,
            title: finalTitle,
            description: clip.description,
            privacyStatus: privacyStatus as any,
            publishedAt: new Date()
          }
        });

        // Mark queue completed if present
        await tx.publishingQueue.updateMany({
          where: { clipId, status: { in: ['QUEUED', 'UPLOADING'] } },
          data: {
            status: 'PUBLISHED',
            completedAt: new Date()
          }
        });

        return publishedRecord;
      });

      return published;
    } catch (err: any) {
      logger.error(`Failed to upload clip ${clipId} to YouTube: ${err.message}`, { error: err });
      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'FAILED' }
      });
      await prisma.publishingQueue.updateMany({
        where: { clipId, status: { in: ['QUEUED', 'UPLOADING'] } },
        data: {
          status: 'FAILED',
          errorMessage: err.message
        }
      });
      throw err;
    }
  }
}

export const youtubeUploadService = new YouTubeUploadService();
