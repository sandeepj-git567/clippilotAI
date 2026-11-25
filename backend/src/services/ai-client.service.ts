import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../config/logger';

export class AiClientService {
  private getClient() {
    return axios.create({
      baseURL: config.aiEngineUrl,
      timeout: 1800000 // 30 minutes for long 1080p video transcription & rendering
    });
  }

  async checkHealth() {
    try {
      const res = await this.getClient().get('/health');
      return res.data;
    } catch (err: any) {
      logger.error(`AI Engine health check failed: ${err.message}`);
      return { status: 'down', error: err.message };
    }
  }

  async transcribeVideo(videoPath: string, language?: string) {
    logger.info(`Sending transcription request to AI Engine (${config.aiEngineUrl}) for: ${videoPath}`);
    // Convert Docker path /app/media/... to host filesystem path if needed
    const resolvedPath = videoPath.startsWith('/app/') ? path.resolve(videoPath.replace('/app/', '')) : videoPath;
    const pathToUse = fs.existsSync(resolvedPath) ? resolvedPath : videoPath;

    try {
      const res = await this.getClient().post('/api/transcribe', {
        videoPath: pathToUse,
        language
      });
      return res.data;
    } catch (err: any) {
      // If ai-engine DNS failed and we are on localhost, fallback to 127.0.0.1:8001
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        logger.warn(`ai-engine hostname not found. Retrying with http://127.0.0.1:8001...`);
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 300000 });
        const fallbackRes = await fallbackClient.post('/api/transcribe', { videoPath: pathToUse, language });
        return fallbackRes.data;
      }
      throw err;
    }
  }

  async analyzeHighlights(
    transcriptData: any,
    videoMetadata: any,
    preferredCount: number = 3,
    minDuration: number = 10,
    maxDuration: number = 15
  ) {
    logger.info(`Sending highlight analysis request to AI Engine`);
    try {
      const res = await this.getClient().post('/api/analyze-highlights', {
        transcriptData,
        videoMetadata,
        preferredCount,
        minDuration,
        maxDuration
      });
      return res.data.highlights;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 300000 });
        const res = await fallbackClient.post('/api/analyze-highlights', {
          transcriptData,
          videoMetadata,
          preferredCount,
          minDuration,
          maxDuration
        });
        return res.data.highlights;
      }
      throw err;
    }
  }

  async generateMetadata(clipTranscript: string, sourceTitle: string, creatorName?: string) {
    try {
      const res = await this.getClient().post('/api/generate-metadata', {
        clipTranscript,
        sourceTitle,
        creatorName
      });
      return res.data;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 300000 });
        const res = await fallbackClient.post('/api/generate-metadata', {
          clipTranscript,
          sourceTitle,
          creatorName
        });
        return res.data;
      }
      throw err;
    }
  }

  async renderClip(params: {
    sourceVideoPath: string;
    startSec: number;
    endSec: number;
    outputPath: string;
    editingFormat: 'SPLIT_SCREEN' | 'FULL_SCREEN' | 'FACECAM' | string;
    backgroundMediaPath?: string;
    wordsOrSegments?: any[];
    presetName?: string;
    splitRatio?: number;
    burnSubtitles?: boolean;
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    highlightColor?: string;
    outlineColor?: string;
    outlineWidth?: number;
    captionPosition?: string;
    animationType?: string;
    facecamPosition?: string;
    facecamSize?: string;
    facecamBorderWidth?: number;
    facecamBorderColor?: string;
    subtleZoom?: boolean;
    cropMode?: string;
  }) {
    logger.info(`Sending render request to AI Engine: ${params.outputPath}`);
    try {
      const res = await this.getClient().post('/api/render-clip', params);
      return res.data;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 300000 });
        const res = await fallbackClient.post('/api/render-clip', params);
        return res.data;
      }
      throw err;
    }
  }

  async downloadVideo(youtubeUrl: string, videoId?: string) {
    logger.info(`Sending video download request to AI Engine: ${youtubeUrl}`);
    try {
      const res = await this.getClient().post('/api/download-video', {
        youtubeUrl,
        videoId
      });
      return res.data;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 600000 });
        const res = await fallbackClient.post('/api/download-video', { youtubeUrl, videoId });
        return res.data;
      }
      throw err;
    }
  }

  async validateQuality(videoPath: string) {
    try {
      const res = await this.getClient().post('/api/validate-quality', {
        videoPath
      });
      return res.data;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 300000 });
        const res = await fallbackClient.post('/api/validate-quality', { videoPath });
        return res.data;
      }
      throw err;
    }
  }

  async generateThumbnail(videoPath: string, outputPath: string, timestampSec: number = 1.0) {
    try {
      const res = await this.getClient().post('/api/generate-thumbnail', {
        videoPath,
        outputPath,
        timestampSec
      });
      return res.data;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' && config.aiEngineUrl.includes('ai-engine')) {
        const fallbackClient = axios.create({ baseURL: 'http://127.0.0.1:8001', timeout: 30000 });
        const res = await fallbackClient.post('/api/generate-thumbnail', { videoPath, outputPath, timestampSec });
        return res.data;
      }
      throw err;
    }
  }
}

export const aiClient = new AiClientService();
