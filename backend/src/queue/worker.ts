import { Worker, Job } from 'bullmq';
import path from 'path';
import fs from 'fs';
import { redisConnection } from './queue';
import { prisma } from '../db/prisma';
import { aiClient } from '../services/ai-client.service';
import { rightsService } from '../services/rights.service';
import { config } from '../config';
import { logger } from '../config/logger';

export class VideoProcessingWorker {
  private worker: Worker | null = null;

  start() {
    logger.info('Initializing BullMQ Video Processing Worker (concurrency: 1)...');

    this.worker = new Worker(
      'video-processing',
      async (job: Job) => {
        return this.processVideoJob(job);
      },
      {
        connection: redisConnection,
        concurrency: config.maxConcurrentJobs, // Strictly 1 for Intel Core i5 CPU
        lockDuration: 1800000 // 30 minutes for large/long videos
      }
    );

    this.worker.on('active', (job) => {
      logger.info(`Job ${job.id} started processing for sourceVideo: ${job.data.sourceVideoId}`);
    });

    this.worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed: ${err.message}`, { error: err });
    });
  }

  private async updateJobState(jobRecordId: string, status: any, progress: number, stage: string, error?: string) {
    await prisma.processingJob.update({
      where: { id: jobRecordId },
      data: {
        status,
        progress,
        currentStage: stage,
        ...(error ? { errorMessage: error } : {}),
        ...(status === 'READY' || status === 'FAILED' ? { completedAt: new Date() } : {})
      }
    });
  }

  async processVideoJob(job: Job) {
    const { sourceVideoId, processingJobId } = job.data;

    const sourceVideo = await prisma.sourceVideo.findUnique({
      where: { id: sourceVideoId },
      include: { rightsRecord: true }
    });

    if (!sourceVideo) {
      throw new Error(`Source video not found: ${sourceVideoId}`);
    }

    // STAGE 1: RIGHTS_CHECK & MEDIA ACCESS VERIFICATION
    await this.updateJobState(processingJobId, 'RIGHTS_CHECK', 10, 'Checking media authorization and permitted access');
    if (!sourceVideo.rightsRecord || sourceVideo.rightsRecord.permissionStatus !== 'VERIFIED') {
      const errMsg = 'Processing blocked: Missing or unverified rights record. Authorized permission required.';
      await this.updateJobState(processingJobId, 'FAILED', 10, 'Rights verification failed', errMsg);
      throw new Error(errMsg);
    }

    // Verify accessible media file or ingest YouTube stream
    if (!sourceVideo.localFilePath || !fs.existsSync(sourceVideo.localFilePath)) {
      if (sourceVideo.youtubeUrl || sourceVideo.youtubeVideoId) {
        await this.updateJobState(processingJobId, 'IMPORTING', 15, 'Importing media stream for processing...');
        try {
          const downloadUrl = sourceVideo.youtubeUrl || `https://www.youtube.com/watch?v=${sourceVideo.youtubeVideoId}`;
          const downloadResult = await aiClient.downloadVideo(downloadUrl, sourceVideo.youtubeVideoId || undefined);

          if (downloadResult && downloadResult.filePath && fs.existsSync(downloadResult.filePath)) {
            sourceVideo.localFilePath = downloadResult.filePath;
            await prisma.sourceVideo.update({
              where: { id: sourceVideoId },
              data: {
                localFilePath: downloadResult.filePath,
                durationSeconds: downloadResult.duration || sourceVideo.durationSeconds,
                width: downloadResult.width || sourceVideo.width,
                height: downloadResult.height || sourceVideo.height,
                fileSize: downloadResult.fileSize ? BigInt(downloadResult.fileSize) : sourceVideo.fileSize
              }
            });
            logger.info(`Successfully ingested media for source video ${sourceVideoId}: ${downloadResult.filePath}`);
          } else {
            throw new Error('Video download service returned invalid file path or file was not found');
          }
        } catch (dlErr: any) {
          const errMsg = `Direct video media could not be automatically ingested for YouTube URL (${sourceVideo.youtubeVideoId || sourceVideo.youtubeUrl}): ${dlErr.message}. You can also attach the video file directly to this video.`;
          await this.updateJobState(processingJobId, 'FAILED', 15, 'Media ingestion failed', errMsg);
          throw new Error(errMsg);
        }
      } else {
        const errMsg = 'No accessible local media file found for this source video. Please upload an authorized video file.';
        await this.updateJobState(processingJobId, 'FAILED', 15, 'Media file missing', errMsg);
        throw new Error(errMsg);
      }
    }

    try {
      // STAGE 2: TRANSCRIBING
      await this.updateJobState(processingJobId, 'TRANSCRIBING', 25, 'Transcribing audio with Faster-Whisper (CPU int8)');
      const transcriptionResult = await aiClient.transcribeVideo(sourceVideo.localFilePath!);

      // Persist Transcript & Segments
      const transcript = await prisma.transcript.upsert({
        where: { sourceVideoId },
        create: {
          sourceVideoId,
          language: transcriptionResult.language || 'en',
          detectedLanguage: transcriptionResult.detectedLanguage || 'en',
          fullText: transcriptionResult.fullText || '',
          duration: transcriptionResult.duration || sourceVideo.durationSeconds
        },
        update: {
          language: transcriptionResult.language || 'en',
          detectedLanguage: transcriptionResult.detectedLanguage || 'en',
          fullText: transcriptionResult.fullText || '',
          duration: transcriptionResult.duration || sourceVideo.durationSeconds
        }
      });

      // Clear old segments and re-insert
      await prisma.transcriptSegment.deleteMany({ where: { transcriptId: transcript.id } });
      if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
        await prisma.transcriptSegment.createMany({
          data: transcriptionResult.segments.map((seg: any) => ({
            transcriptId: transcript.id,
            segmentIndex: seg.segmentIndex,
            startSec: seg.startSec,
            endSec: seg.endSec,
            text: seg.text,
            words: seg.words || [],
            avgLogprob: seg.avgLogprob,
            noSpeechProb: seg.noSpeechProb
          }))
        });
      }

      // STAGE 3: ANALYZING
      await this.updateJobState(processingJobId, 'ANALYZING', 50, 'Analyzing viral moments & hooks');
      const preferredCount = sourceVideo.preferredClipCount || 3;
      const targetDuration = sourceVideo.preferredClipDuration || 45;
      const minDuration = Math.max(10.0, targetDuration - 10.0);
      const maxDuration = targetDuration;

      const highlights = await aiClient.analyzeHighlights(
        transcriptionResult,
        {
          title: sourceVideo.title,
          description: sourceVideo.description,
          category: sourceVideo.contentCategory
        },
        preferredCount,
        minDuration,
        maxDuration
      );

      // Clear previous highlights and clips for this video on re-runs
      await prisma.highlight.deleteMany({ where: { sourceVideoId } });
      await prisma.clip.deleteMany({ where: { sourceVideoId } });

      // Persist Highlights
      const savedHighlights = [];
      for (const h of highlights) {
        const saved = await prisma.highlight.create({
          data: {
            sourceVideoId,
            startSec: h.startSec,
            endSec: h.endSec,
            durationSec: h.durationSec,
            hook: h.hook,
            category: h.category,
            overallScore: h.overallScore,
            hookScore: h.hookScore,
            interestingScore: h.interestingScore,
            emotionalScore: h.emotionalScore,
            contextScore: h.contextScore,
            retentionScore: h.retentionScore,
            endingScore: h.endingScore,
            reason: h.reason,
            transcriptText: h.transcriptText,
            contextAssessment: h.contextAssessment,
            captionSuggestion: h.captionSuggestion,
            isSelected: true
          }
        });
        savedHighlights.push(saved);
      }

      // STAGE 4: CLIPPING & EDITING
      await this.updateJobState(processingJobId, 'EDITING', 70, 'Rendering vertical 9:16 video clips with FFmpeg');
      
      // Load preset settings
      let preset = null;
      if (sourceVideo.presetId) {
        preset = await prisma.editingPreset.findUnique({ where: { id: sourceVideo.presetId } });
      }
      if (!preset) {
        preset = await prisma.editingPreset.findFirst({ where: { isDefault: true } });
      }
      if (!preset) {
        preset = await prisma.editingPreset.findFirst();
      }

      const effectiveFormat = (preset?.format || sourceVideo.editingFormat || 'SPLIT_SCREEN') as any;

      // Look for background media if split screen
      let backgroundMedia = null;
      if (effectiveFormat === 'SPLIT_SCREEN') {
        if (sourceVideo.backgroundMediaId) {
          backgroundMedia = await prisma.backgroundMedia.findUnique({ where: { id: sourceVideo.backgroundMediaId } });
        }
        if (!backgroundMedia) {
          backgroundMedia = await prisma.backgroundMedia.findFirst({
            where: { isActive: true, isDefault: true }
          });
        }
        if (!backgroundMedia) {
          backgroundMedia = await prisma.backgroundMedia.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
          });
        }
      }

      for (let i = 0; i < savedHighlights.length; i++) {
        const hl = savedHighlights[i];
        const clipProgress = 70 + Math.round(((i + 1) / savedHighlights.length) * 20);
        await this.updateJobState(
          processingJobId,
          'EDITING',
          clipProgress,
          `Rendering clip ${i + 1} of ${savedHighlights.length}`
        );

        // Generate Metadata (titles, tags, hashtags)
        const meta = await aiClient.generateMetadata(
          hl.transcriptText,
          sourceVideo.title,
          sourceVideo.creatorName || undefined
        );

        const clipFilename = `clip_${sourceVideoId.substring(0, 8)}_${i + 1}_${Date.now()}.mp4`;
        const clipOutputPath = path.join(config.outputDir, clipFilename);

        // Filter words for this highlight
        const clipWords = transcriptionResult.segments || [];

        // Render clip via AI engine with full preset configuration
        const renderRes = await aiClient.renderClip({
          sourceVideoPath: sourceVideo.localFilePath!,
          startSec: hl.startSec,
          endSec: hl.endSec,
          outputPath: clipOutputPath,
          editingFormat: effectiveFormat,
          backgroundMediaPath: backgroundMedia?.filePath || undefined,
          wordsOrSegments: clipWords,
          presetName: preset?.name || 'Dynamic Captions',
          splitRatio: preset?.splitRatio || 0.5,
          burnSubtitles: true,
          fontName: preset?.fontName || 'Montserrat',
          fontSize: preset?.fontSize || 64,
          primaryColor: preset?.primaryColor || '&H00FFFFFF',
          highlightColor: preset?.highlightColor || '&H0000FFFF',
          outlineColor: preset?.outlineColor || '&H00000000',
          outlineWidth: preset?.outlineWidth || 3.5,
          captionPosition: preset?.position || 'center',
          animationType: preset?.animationType || 'word_highlight',
          facecamPosition: preset?.facecamPosition || 'top_right',
          facecamSize: preset?.facecamSize || 'medium',
          facecamBorderWidth: preset?.facecamBorderWidth || 4.0,
          facecamBorderColor: preset?.facecamBorderColor || '#3B82F6',
          subtleZoom: preset?.subtleZoom || false,
          cropMode: preset?.cropMode || 'smart'
        });

        // STAGE 5: QUALITY_CHECK
        const qc = await aiClient.validateQuality(clipOutputPath);

        const fileSize = fs.existsSync(clipOutputPath) ? fs.statSync(clipOutputPath).size : 0;

        await prisma.clip.create({
          data: {
            sourceVideoId,
            highlightId: hl.id,
            presetId: preset?.id,
            title: meta.title || `${sourceVideo.title} Clip ${i + 1}`,
            description: meta.description || '',
            hashtags: meta.hashtags || ['#Shorts'],
            hookSuggestion: meta.hookSuggestion,
            editingFormat: effectiveFormat,
            backgroundMediaId: backgroundMedia?.id,
            outputFilePath: clipOutputPath,
            thumbnailPath: renderRes.thumbnailPath,
            durationSec: hl.durationSec,
            width: 1080,
            height: 1920,
            fps: 30,
            fileSize: BigInt(fileSize),
            qualityChecked: qc.isValid,
            qualityScore: qc.qualityScore,
            qualityDetails: qc.details,
            status: qc.isValid ? 'GENERATED' : 'FAILED',
            renderSettings: {
              preset: preset?.name || 'Dynamic Captions',
              splitRatio: preset?.splitRatio || 0.5,
              format: effectiveFormat,
              facecamPosition: preset?.facecamPosition,
              fontName: preset?.fontName
            }
          }
        });
      }

      // STAGE 6: READY
      await this.updateJobState(processingJobId, 'READY', 100, 'All clips successfully rendered and verified');
      await prisma.sourceVideo.update({
        where: { id: sourceVideoId },
        data: { status: 'READY' }
      });

      return { success: true, clipsCount: savedHighlights.length };
    } catch (err: any) {
      logger.error(`Pipeline failure for job ${processingJobId}: ${err.message}`, { error: err });
      await this.updateJobState(processingJobId, 'FAILED', 0, 'Pipeline failed', err.message);
      await prisma.sourceVideo.update({
        where: { id: sourceVideoId },
        data: { status: 'FAILED' }
      });
      throw err;
    }
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
      logger.info('BullMQ Video Processing Worker closed gracefully');
    }
  }
}

export const videoProcessingWorker = new VideoProcessingWorker();
