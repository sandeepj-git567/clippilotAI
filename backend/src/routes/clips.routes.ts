import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { prisma } from '../db/prisma';
import { publishingScheduler } from '../services/publishing-scheduler.service';
import { youtubeUploadService } from '../services/youtube-upload.service';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { config } from '../config';
import { logger } from '../config/logger';
import { aiClient } from '../services/ai-client.service';

const router = Router();

router.use(authMiddleware);

// GET /api/clips - List all clips
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const clips = await prisma.clip.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourceVideo: { select: { id: true, title: true, userId: true } },
        highlight: { select: { id: true, overallScore: true } }
      }
    });

    const serialized = clips.map(c => ({
      ...c,
      fileSize: c.fileSize ? c.fileSize.toString() : null
    }));

    res.json({ success: true, clips: serialized });
  } catch (err) {
    next(err);
  }
});

// GET /api/clips/:id - Single clip details including quality info
router.get('/:id', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: req.params.id },
      include: {
        sourceVideo: { select: { id: true, title: true, creatorName: true, editingFormat: true } },
        highlight: true,
        publishedVideo: true
      }
    });

    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    res.json({
      success: true,
      clip: {
        ...clip,
        fileSize: clip.fileSize ? clip.fileSize.toString() : null
      }
    });
  } catch (err) {
    next(err);
  }
});

// Helper to resolve media files whether running in container or host
function resolveClipFile(targetPath?: string | null): string | null {
  if (!targetPath) return null;
  if (fs.existsSync(targetPath)) return targetPath;

  const basename = path.basename(targetPath);
  // Try config.outputDir
  const candidate1 = path.join(config.outputDir, basename);
  if (fs.existsSync(candidate1)) return candidate1;

  // Try relative media/output
  const candidate2 = path.resolve(process.cwd(), 'media', 'output', basename);
  if (fs.existsSync(candidate2)) return candidate2;

  const candidate3 = path.resolve(__dirname, '../../../media/output', basename);
  if (fs.existsSync(candidate3)) return candidate3;

  return null;
}

// GET /api/clips/:id/preview - Return streaming info for the clip file
router.get('/:id/preview', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: req.params.id } });
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    const resolvedFilePath = resolveClipFile(clip.outputFilePath);
    if (!resolvedFilePath) {
      return res.status(404).json({ success: false, message: 'Clip file not found on disk' });
    }

    const stat = fs.statSync(resolvedFilePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });

      fs.createReadStream(resolvedFilePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(resolvedFilePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/clips/:id/thumbnail - Return clip thumbnail image
router.get('/:id/thumbnail', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: req.params.id } });
    if (!clip || !clip.thumbnailPath) {
      return res.status(404).json({ success: false, message: 'Thumbnail not found' });
    }

    const resolvedThumb = resolveClipFile(clip.thumbnailPath);
    if (!resolvedThumb) {
      return res.status(404).json({ success: false, message: 'Thumbnail file not found on disk' });
    }

    res.sendFile(path.resolve(resolvedThumb));
  } catch (err) {
    next(err);
  }
});

// POST /api/clips/:id/approve - Approve a clip
router.post('/:id/approve', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: req.params.id } });
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    const updated = await prisma.clip.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });

    logger.info(`Clip ${req.params.id} approved`);
    res.json({ success: true, clip: { ...updated, fileSize: updated.fileSize ? updated.fileSize.toString() : null } });
  } catch (err) {
    next(err);
  }
});

// POST /api/clips/:id/reject - Reject a clip
router.post('/:id/reject', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: req.params.id } });
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    const { reason } = req.body;

    const updated = await prisma.clip.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        ...(reason ? { rejectionReason: reason } : {})
      }
    });

    logger.info(`Clip ${req.params.id} rejected`);
    res.json({ success: true, clip: { ...updated, fileSize: updated.fileSize ? updated.fileSize.toString() : null } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clips/:id/metadata - Update clip metadata
router.patch('/:id/metadata', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: req.params.id } });
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    const { title, description, hashtags } = req.body;

    const updated = await prisma.clip.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(hashtags !== undefined ? { hashtags } : {})
      }
    });

    res.json({ success: true, clip: { ...updated, fileSize: updated.fileSize ? updated.fileSize.toString() : null } });
  } catch (err) {
    next(err);
  }
});

// POST /api/clips/:id/render - Trigger re-render with selected preset and background
router.post('/:id/render', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: req.params.id },
      include: {
        sourceVideo: true,
        highlight: true
      }
    });

    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    if (!clip.sourceVideo?.localFilePath) {
      return res.status(400).json({ success: false, message: 'Source video file path not available' });
    }

    // Resolve Preset: from req.body.presetId, or clip.presetId, or default
    const targetPresetId = req.body.presetId || clip.presetId;
    let preset = null;
    if (targetPresetId) {
      preset = await prisma.editingPreset.findUnique({ where: { id: targetPresetId } });
    }
    if (!preset) {
      preset = await prisma.editingPreset.findFirst({ where: { isDefault: true } });
    }
    if (!preset) {
      preset = await prisma.editingPreset.findFirst();
    }

    const effectiveFormat = (req.body.editingFormat || preset?.format || clip.editingFormat || 'SPLIT_SCREEN') as any;

    // Resolve Background Media if SPLIT_SCREEN
    let backgroundMedia = null;
    if (effectiveFormat === 'SPLIT_SCREEN') {
      const bgId = req.body.backgroundMediaId || clip.backgroundMediaId || clip.sourceVideo.backgroundMediaId;
      if (bgId) {
        backgroundMedia = await prisma.backgroundMedia.findUnique({ where: { id: bgId } });
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

    // Fetch transcript segments for burning subtitles
    const transcript = await prisma.transcript.findUnique({
      where: { sourceVideoId: clip.sourceVideoId },
      include: { segments: { orderBy: { startSec: 'asc' } } }
    });

    const startSec = clip.highlight?.startSec ?? 0;
    const endSec = clip.highlight?.endSec ?? (startSec + (clip.durationSec || 45));

    const renderPayload = {
      sourceVideoPath: clip.sourceVideo.localFilePath,
      startSec,
      endSec,
      outputPath: clip.outputFilePath || path.join(config.outputDir, `clip_${clip.id}.mp4`),
      editingFormat: effectiveFormat,
      backgroundMediaPath: backgroundMedia?.filePath || undefined,
      wordsOrSegments: transcript?.segments || [],
      presetName: preset?.name || 'Dynamic Captions',
      splitRatio: preset?.splitRatio || 0.5,
      burnSubtitles: req.body.burnSubtitles ?? true,
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
      subtleZoom: preset?.subtleZoom ?? false,
      cropMode: preset?.cropMode || 'smart'
    };

    logger.info(`Triggering re-render for clip ${req.params.id} with preset: ${preset?.name} (${effectiveFormat})`);

    const renderRes = await aiClient.renderClip(renderPayload);

    // Update clip in database
    const updated = await prisma.clip.update({
      where: { id: req.params.id as string },
      data: {
        presetId: preset?.id,
        editingFormat: effectiveFormat,
        backgroundMediaId: backgroundMedia?.id,
        thumbnailPath: renderRes.thumbnailPath,
        status: 'GENERATED',
        renderSettings: {
          preset: preset?.name,
          format: effectiveFormat,
          splitRatio: preset?.splitRatio,
          facecamPosition: preset?.facecamPosition,
          fontName: preset?.fontName,
          renderedAt: new Date().toISOString()
        }
      }
    });

    res.json({
      success: true,
      message: 'Clip re-rendered successfully',
      clip: {
        ...updated,
        fileSize: updated.fileSize ? updated.fileSize.toString() : null
      },
      result: renderRes
    });
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ success: false, message: 'AI engine is not reachable' });
    }
    next(err);
  }
});

// POST /api/clips/:id/schedule - Schedule clip for publishing
router.post('/:id/schedule', async (req, res, next) => {
  try {
    const { scheduledTime } = req.body;
    const targetTime = scheduledTime ? new Date(scheduledTime) : undefined;

    const queueItem = await publishingScheduler.scheduleClip(req.params.id, targetTime);

    res.json({ success: true, queueItem });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (
      err.message?.includes('Only APPROVED') ||
      err.message?.includes('rights') ||
      err.message?.includes('No connected YouTube')
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// POST /api/clips/:id/publish - Directly publish clip to YouTube
router.post('/:id/publish', async (req: AuthenticatedRequest, res, next) => {
  try {
    const clipId = req.params.id as string;
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { sourceVideo: true }
    });

    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    // Find connected YouTube account for the clip owner
    const account = await prisma.youTubeAccount.findFirst({
      where: { userId: clip.sourceVideo.userId, isConnected: true }
    });

    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'No connected YouTube account found. Please connect your YouTube account first.'
      });
    }

    const { privacyStatus = 'PUBLIC', youtubeAccountId } = req.body;

    const published = await youtubeUploadService.uploadClip({
      clipId,
      youtubeAccountId: (youtubeAccountId as string) || account.id,
      privacyStatus
    });

    res.json({ success: true, published });
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message?.includes('quality checks') || err.message?.includes('does not exist')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// DELETE /api/clips/:id - Delete clip and local file
router.delete('/:id', async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({ where: { id: req.params.id } });
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found' });
    }

    // Remove local output file
    if (clip.outputFilePath && fs.existsSync(clip.outputFilePath)) {
      try {
        fs.unlinkSync(clip.outputFilePath);
      } catch (e) {
        logger.warn(`Could not delete clip file: ${clip.outputFilePath}`);
      }
    }

    // Remove thumbnail if present
    if (clip.thumbnailPath && fs.existsSync(clip.thumbnailPath)) {
      try {
        fs.unlinkSync(clip.thumbnailPath);
      } catch (e) {
        logger.warn(`Could not delete clip thumbnail: ${clip.thumbnailPath}`);
      }
    }

    await prisma.clip.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Clip deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
