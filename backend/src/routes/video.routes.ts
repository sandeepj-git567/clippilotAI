import { Router } from 'express';
import fs from 'fs';
import { prisma } from '../db/prisma';
import { videoService } from '../services/video.service';
import { youtubeMetadataService } from '../services/youtube-metadata.service';
import { videoProcessingQueue } from '../queue/queue';
import { uploadVideoMiddleware } from '../middlewares/upload.middleware';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// GET /api/videos/youtube-info - Extract videoId and fetch YouTube metadata via official API
router.get('/youtube-info', async (req: AuthenticatedRequest, res, next) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL query parameter is required.' });
    }

    const videoId = youtubeMetadataService.extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL. Please provide a valid watch, youtu.be, or Shorts URL.'
      });
    }

    try {
      const metadata = await youtubeMetadataService.fetchVideoMetadata(videoId, req.user?.id);
      return res.json({ success: true, metadata });
    } catch (err: any) {
      // Return extracted video ID even if external API quota or key is not available
      return res.json({
        success: true,
        metadata: {
          videoId,
          title: '',
          description: '',
          channelTitle: '',
          note: err.message
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/submit - Submit Video (supports Direct File Upload or YouTube URL)
router.post('/submit', uploadVideoMiddleware.single('mediaFile'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const {
      youtubeUrl,
      title,
      creatorName,
      description,
      contentCategory = 'Entertainment',
      preferredClipCount = 3,
      preferredClipDuration = 45,
      editingFormat = 'SPLIT_SCREEN',
      publishingPreference = 'MANUAL',
      presetId,
      backgroundMediaId
    } = req.body;

    const hasFile = !!req.file;
    const hasUrl = !!youtubeUrl && typeof youtubeUrl === 'string' && youtubeUrl.trim().length > 0;

    if (!hasFile && !hasUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a video file upload or a YouTube URL.'
      });
    }

    let youtubeVideoId: string | null = null;
    if (hasUrl) {
      youtubeVideoId = youtubeMetadataService.extractVideoId(youtubeUrl.trim());
      if (!youtubeVideoId && !hasFile) {
        return res.status(400).json({
          success: false,
          message: 'Invalid YouTube URL format. Supported formats: youtube.com/watch?v=..., youtu.be/..., and youtube.com/shorts/...'
        });
      }
    }

    const videoTitle = (title && title.trim()) || req.file?.originalname || 'Uploaded Source Video';

    const parsedClipCount = Math.min(Math.max(parseInt(String(preferredClipCount || 3), 10), 1), 10);
    const parsedDuration = Math.min(Math.max(parseInt(String(preferredClipDuration || 45), 10), 10), 59);

    let localFilePath: string | null = req.file?.path || null;
    let originalFilename: string | null = req.file?.originalname || null;
    let fileSize: bigint | null = req.file ? BigInt(req.file.size) : null;
    let durationSeconds: number = 60.0;
    let width = 1920;
    let height = 1080;
    let fps = 30;

    // If an authorized media file is uploaded or existing locally, extract metadata
    if (localFilePath && fs.existsSync(localFilePath)) {
      const meta = await videoService.extractMetadata(localFilePath);
      durationSeconds = meta.duration;
      width = meta.width;
      height = meta.height;
      fps = meta.fps;
    } else if (youtubeVideoId) {
      // Check if an authorized media source file exists locally for this YouTube video ID
      const authMedia = await youtubeMetadataService.findAuthorizedMediaSource(youtubeVideoId);
      if (authMedia.hasAuthorizedMedia && authMedia.filePath) {
        localFilePath = authMedia.filePath;
        originalFilename = `${youtubeVideoId}.mp4`;
        const meta = await videoService.extractMetadata(localFilePath);
        fileSize = BigInt(meta.size);
        durationSeconds = meta.duration;
        width = meta.width;
        height = meta.height;
        fps = meta.fps;
      }
    }

    // Check duplicate submission
    const isDuplicate = await videoService.checkDuplicate(
      hasUrl ? youtubeUrl : undefined,
      originalFilename || undefined,
      fileSize ? Number(fileSize) : undefined
    );

    const userId = req.user!.id;

    // Create SourceVideo & Default RightsRecord in transaction
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.sourceVideo.create({
        data: {
          userId,
          youtubeUrl: hasUrl ? youtubeUrl.trim() : null,
          youtubeVideoId,
          title: videoTitle,
          creatorName: creatorName ? creatorName.trim() : null,
          description: description ? description.trim() : null,
          contentCategory: contentCategory || 'Entertainment',
          preferredClipCount: parsedClipCount,
          preferredClipDuration: parsedDuration,
          editingFormat: editingFormat as any,
          publishingPreference: publishingPreference as any,
          presetId: presetId || null,
          backgroundMediaId: backgroundMediaId || null,
          localFilePath: localFilePath || '',
          originalFilename: originalFilename || (youtubeVideoId ? `youtube_${youtubeVideoId}` : 'uploaded_video.mp4'),
          fileSize: fileSize || BigInt(0),
          durationSeconds,
          width,
          height,
          fps,
          isDuplicate,
          status: 'SUBMITTED'
        }
      });

      // Maintain RightsRecord relation for compatibility with downstream tables
      const rights = await tx.rightsRecord.create({
        data: {
          sourceVideoId: source.id,
          rightsHolder: creatorName || 'Source Creator',
          permissionStatus: 'VERIFIED',
          licenceType: 'USER_OWNED',
          canEdit: true,
          canRepublish: true,
          canCommercialize: false,
          attributionRequired: false,
          attributionText: creatorName ? `Created by ${creatorName}` : null,
          evidenceNotes: hasFile ? 'Uploaded directly by user' : `Submitted via YouTube URL (${youtubeUrl})`,
          verifiedAt: new Date(),
          verifiedBy: req.user!.email
        }
      });

      // Create initial processing job record
      const job = await tx.processingJob.create({
        data: {
          sourceVideoId: source.id,
          type: 'FULL_PIPELINE',
          status: 'QUEUED',
          progress: 5,
          currentStage: 'Queued for processing'
        }
      });

      return { source, rights, job };
    });

    // Enqueue in BullMQ video processing queue
    await videoProcessingQueue.add(
      'process-video',
      {
        sourceVideoId: result.source.id,
        processingJobId: result.job.id
      },
      {
        jobId: `video-${result.source.id}`
      }
    );

    logger.info(`Source video submitted and queued: ${result.source.id} (${videoTitle})`);

    res.status(201).json({
      success: true,
      sourceVideo: {
        ...result.source,
        fileSize: result.source.fileSize?.toString() || '0'
      },
      rights: result.rights,
      job: result.job
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/videos - List all submitted source videos
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const videos = await prisma.sourceVideo.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rightsRecord: true,
        processingJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { clips: true, highlights: true } }
      }
    });

    const serialized = videos.map(v => ({
      ...v,
      fileSize: v.fileSize ? v.fileSize.toString() : '0'
    }));

    res.json({ success: true, videos: serialized });
  } catch (err) {
    next(err);
  }
});

// GET /api/videos/:id - Single source video details
router.get('/:id', async (req, res, next) => {
  try {
    const video = await prisma.sourceVideo.findUnique({
      where: { id: req.params.id },
      include: {
        rightsRecord: true,
        processingJobs: { orderBy: { createdAt: 'desc' } },
        transcript: { include: { segments: { take: 50 } } },
        highlights: true,
        clips: true
      }
    });

    if (!video) {
      return res.status(404).json({ success: false, message: 'Source video not found' });
    }

    res.json({
      success: true,
      video: {
        ...video,
        fileSize: video.fileSize ? video.fileSize.toString() : '0',
        clips: video.clips.map(c => ({
          ...c,
          fileSize: c.fileSize ? c.fileSize.toString() : null
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/:id/attach-media - Attach or update a local master video file
router.post('/:id/attach-media', uploadVideoMiddleware.single('mediaFile'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided' });
    }

    const videoId = String(req.params.id);
    const sourceVideo = await prisma.sourceVideo.findUnique({ where: { id: videoId } });
    if (!sourceVideo) {
      return res.status(404).json({ success: false, message: 'Source video not found' });
    }

    const meta = await videoService.extractMetadata(req.file.path);
    const updated = await prisma.sourceVideo.update({
      where: { id: videoId },
      data: {
        localFilePath: req.file.path,
        fileSize: BigInt(req.file.size),
        durationSeconds: meta.duration,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
        originalFilename: req.file.originalname
      }
    });

    res.json({
      success: true,
      message: 'Video file attached successfully',
      video: {
        ...updated,
        fileSize: updated.fileSize ? updated.fileSize.toString() : '0'
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/:id/analyze - Manually trigger or re-run analysis
router.post('/:id/analyze', async (req, res, next) => {
  try {
    const sourceVideo = await prisma.sourceVideo.findUnique({
      where: { id: req.params.id },
      include: { rightsRecord: true }
    });

    if (!sourceVideo) {
      return res.status(404).json({ success: false, message: 'Source video not found' });
    }

    const job = await prisma.processingJob.create({
      data: {
        sourceVideoId: sourceVideo.id,
        type: 'FULL_PIPELINE',
        status: 'QUEUED',
        progress: 0,
        currentStage: 'Re-analysis queued'
      }
    });

    await videoProcessingQueue.add(
      'process-video',
      {
        sourceVideoId: sourceVideo.id,
        processingJobId: job.id
      },
      {
        jobId: `video-${sourceVideo.id}-${Date.now()}`
      }
    );

    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/videos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const video = await prisma.sourceVideo.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

    // Remove local file if present
    if (video.localFilePath && fs.existsSync(video.localFilePath)) {
      try { fs.unlinkSync(video.localFilePath); } catch {}
    }

    await prisma.sourceVideo.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Source video deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
