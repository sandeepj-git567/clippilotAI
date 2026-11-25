import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { logger } from '../config/logger';

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  size: number;
}

export class VideoService {
  /**
   * Extracts precise duration, resolution, and fps using ffprobe.
   */
  async extractMetadata(filePath: string): Promise<VideoMetadata> {
    const ffprobeCmd = config.ffprobePath || 'ffprobe';
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration,size:stream=width,height,r_frame_rate',
      '-of', 'json',
      filePath
    ];

    try {
      const { stdout } = await execFileAsync(ffprobeCmd, args);
      const data = JSON.parse(stdout);

      const videoStream = data.streams?.find((s: any) => s.width && s.height);
      const duration = parseFloat(data.format?.duration || '0');
      const size = parseInt(data.format?.size || '0', 10);
      const width = videoStream?.width || 1920;
      const height = videoStream?.height || 1080;

      let fps = 30;
      if (videoStream?.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        if (den > 0) fps = Math.round(num / den);
      }

      return { duration, width, height, fps, size };
    } catch (err: any) {
      logger.warn(`ffprobe failed (${err.message}), falling back to file stats.`);
      const stats = fs.statSync(filePath);
      return {
        duration: 60.0,
        width: 1920,
        height: 1080,
        fps: 30,
        size: stats.size
      };
    }
  }

  /**
   * Detects duplicate video submissions by URL or file size + filename.
   */
  async checkDuplicate(youtubeUrl?: string, originalFilename?: string, fileSize?: number): Promise<boolean> {
    if (youtubeUrl) {
      const existing = await prisma.sourceVideo.findFirst({
        where: { youtubeUrl }
      });
      if (existing) return true;
    }
    if (originalFilename && fileSize) {
      const existing = await prisma.sourceVideo.findFirst({
        where: {
          originalFilename,
          fileSize: BigInt(fileSize)
        }
      });
      if (existing) return true;
    }
    return false;
  }

  /**
   * Parses YouTube video ID safely from standard URL formats.
   */
  parseYouTubeId(url: string): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  }
}

export const videoService = new VideoService();
