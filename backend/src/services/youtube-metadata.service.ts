import { google } from 'googleapis';
import { config } from '../config';
import { prisma } from '../db/prisma';
import { youtubeOAuthService } from './youtube-oauth.service';
import { logger } from '../config/logger';

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  durationSeconds?: number;
  tags?: string[];
  thumbnails?: any;
}

export class YouTubeMetadataService {
  /**
   * Parses and validates a YouTube video ID from standard watch, shorts, and embed URLs.
   */
  extractVideoId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();
    // Matches youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
    const regex = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = cleanUrl.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Parses ISO 8601 duration format (e.g. PT4M13S) into total seconds.
   */
  private parseIsoDuration(durationStr?: string | null): number {
    if (!durationStr) return 0;
    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Fetches video metadata through official YouTube Data API v3.
   * Uses an authenticated user client or Gemini/API Key if available.
   */
  async fetchVideoMetadata(videoId: string, userId?: string): Promise<YouTubeVideoMetadata> {
    logger.info(`Fetching official YouTube metadata for videoId: ${videoId}`);

    let authClient: any = null;

    if (userId) {
      try {
        const connectedAccount = await prisma.youTubeAccount.findFirst({
          where: { userId, isConnected: true }
        });
        if (connectedAccount) {
          authClient = await youtubeOAuthService.getAuthenticatedClient(connectedAccount.id);
        }
      } catch (err: any) {
        logger.warn(`Could not get authenticated OAuth client for user ${userId}: ${err.message}`);
      }
    }

    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: authClient || undefined
      });

      const params: any = {
        part: ['snippet', 'contentDetails', 'status'],
        id: [videoId]
      };

      if (!authClient && config.geminiApiKey) {
        // Fallback or API key if supported by Google Cloud project
        params.key = config.geminiApiKey;
      }

      const res = await youtube.videos.list(params);
      const item = res.data.items?.[0];

      if (!item) {
        throw new Error(`No YouTube video found for ID: ${videoId}. Please verify the URL.`);
      }

      const snippet = item.snippet;
      const contentDetails = item.contentDetails;
      const durationSeconds = this.parseIsoDuration(contentDetails?.duration);

      return {
        videoId,
        title: snippet?.title || 'YouTube Video',
        description: snippet?.description || '',
        channelTitle: snippet?.channelTitle || 'YouTube Creator',
        channelId: snippet?.channelId || '',
        durationSeconds,
        tags: snippet?.tags || [],
        thumbnails: snippet?.thumbnails
      };
    } catch (err: any) {
      logger.error(`YouTube Data API fetch failed for videoId ${videoId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Attempts to locate an authorized media source file for this video or creator.
   * Checks uploaded media, background library, or creator authorized assets.
   */
  async findAuthorizedMediaSource(videoId: string, originalFilename?: string): Promise<{
    hasAuthorizedMedia: boolean;
    filePath?: string;
    reason?: string;
  }> {
    // 1. Check if media file already exists locally for this video ID
    const uploadsDir = config.uploadsDir;
    const possibleNames = [
      `${videoId}.mp4`,
      `${videoId}.webm`,
      `${videoId}.mkv`,
      `youtube_${videoId}.mp4`
    ];

    for (const name of possibleNames) {
      const fullPath = `${uploadsDir}/${name}`;
      const fs = await import('fs');
      if (fs.existsSync(fullPath)) {
        return {
          hasAuthorizedMedia: true,
          filePath: fullPath
        };
      }
    }

    return {
      hasAuthorizedMedia: false,
      reason:
        `Direct video stream access for YouTube URL (${videoId}) requires creator-authorized media integration. ` +
        `ClipPilot AI strictly adheres to YouTube Terms of Service and does not use unauthorized stream ripping or bypass techniques. ` +
        `To process this video, place the creator's master file in the media folder or upload via authorized creator integration.`
    };
  }
}

export const youtubeMetadataService = new YouTubeMetadataService();
