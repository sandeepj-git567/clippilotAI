import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { config } from '../config';
import { logger } from '../config/logger';
import { videoService } from '../services/video.service';
import { aiClient } from '../services/ai-client.service';

const router = Router();

// Set up multer storage for background media
const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = config.backgroundsDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const ALLOWED_BACKGROUND_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/avi',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const uploadBackgroundMiddleware = multer({
  storage: backgroundStorage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1 GB max for background clips
  fileFilter: (req, file, cb) => {
    if (
      ALLOWED_BACKGROUND_TYPES.includes(file.mimetype) ||
      file.originalname.match(/\.(mp4|webm|mov|mkv|avi|jpg|jpeg|png|webp)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format for background media. Supported: MP4, WebM, MOV, MKV, AVI, JPG, PNG, WEBP'));
    }
  }
});

// Helper to resolve background media files whether on host or container
export function resolveBackgroundFile(targetPath?: string | null): string | null {
  if (!targetPath) return null;
  if (fs.existsSync(targetPath)) return targetPath;

  const basename = path.basename(targetPath);
  const candidates = [
    path.join(config.backgroundsDir, basename),
    path.resolve(process.cwd(), 'media', 'backgrounds', basename),
    path.resolve(__dirname, '../../../media/backgrounds', basename),
    path.resolve('/app/media/backgrounds', basename)
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

router.use(authMiddleware);

// GET /api/background-media - List all background media
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const mediaList = await prisma.backgroundMedia.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    const formatted = mediaList.map((m) => ({
      ...m,
      fileSize: m.fileSize.toString(),
      previewUrl: `/api/background-media/${m.id}/preview`,
      thumbnailUrl: `/api/background-media/${m.id}/thumbnail`
    }));

    res.json({ success: true, media: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /api/background-media - Upload a new background video or image
router.post('/', uploadBackgroundMiddleware.single('mediaFile'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No background media file provided' });
    }

    const { name, title, description, category, isLoopable, isDefault } = req.body;
    const mediaTitle = (name || title || req.file.originalname).trim();

    if (!mediaTitle) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: 'Background media title is required' });
    }

    const isImage = !!req.file.mimetype?.startsWith('image/') || !!req.file.originalname.match(/\.(jpg|jpeg|png|webp)$/i);

    // Extract metadata
    let durationSec = isImage ? 60.0 : 60.0;
    let width = 1080;
    let height = 1920;
    let fps = 30;

    try {
      const meta = await videoService.extractMetadata(req.file.path);
      durationSec = meta.duration || durationSec;
      width = meta.width || width;
      height = meta.height || height;
      fps = meta.fps || fps;
    } catch (metaErr) {
      logger.warn(`Could not extract full metadata for uploaded background: ${metaErr}`);
    }

    const shouldBeDefault = isDefault === 'true' || isDefault === true;
    if (shouldBeDefault) {
      await prisma.backgroundMedia.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    // Create DB record
    const media = await prisma.backgroundMedia.create({
      data: {
        title: mediaTitle,
        description: description ? description.trim() : null,
        filePath: req.file.path,
        fileSize: BigInt(req.file.size),
        category: category || 'Gaming',
        durationSec,
        width,
        height,
        fps,
        isLoopable: isLoopable === 'false' ? false : true,
        isActive: true,
        isDefault: shouldBeDefault
      }
    });

    // Generate thumbnail: if image, copy directly; if video, extract frame
    try {
      const thumbFilename = `${path.parse(req.file.filename).name}_thumb.jpg`;
      const thumbPath = path.join(config.backgroundsDir, thumbFilename);
      if (isImage) {
        fs.copyFileSync(req.file.path, thumbPath);
      } else {
        const thumbTimestamp = Math.min(1.5, durationSec / 2.0);
        await aiClient.generateThumbnail(req.file.path, thumbPath, thumbTimestamp);
      }
    } catch (thumbErr) {
      logger.warn(`Thumbnail generation for background media deferred: ${thumbErr}`);
    }

    logger.info(`Background media uploaded successfully: ${mediaTitle} (${req.file.filename})`);

    res.status(201).json({
      success: true,
      media: {
        ...media,
        fileSize: media.fileSize.toString(),
        previewUrl: `/api/background-media/${media.id}/preview`,
        thumbnailUrl: `/api/background-media/${media.id}/thumbnail`
      }
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    next(err);
  }
});

// GET /api/background-media/:id/preview - Stream background video or display image
router.get('/:id/preview', async (req, res, next) => {
  try {
    const media = await prisma.backgroundMedia.findUnique({ where: { id: req.params.id } });
    if (!media) {
      return res.status(404).json({ success: false, message: 'Background media not found' });
    }

    const resolvedFilePath = resolveBackgroundFile(media.filePath);
    if (!resolvedFilePath) {
      return res.status(404).json({ success: false, message: 'Background media file not found on disk' });
    }

    const ext = path.extname(resolvedFilePath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

    if (isImage) {
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      res.setHeader('Content-Type', mime);
      return fs.createReadStream(resolvedFilePath).pipe(res);
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

// GET /api/background-media/:id/thumbnail - Serve thumbnail image
router.get('/:id/thumbnail', async (req, res, next) => {
  try {
    const media = await prisma.backgroundMedia.findUnique({ where: { id: req.params.id } });
    if (!media) {
      return res.status(404).json({ success: false, message: 'Background media not found' });
    }

    const resolvedMedia = resolveBackgroundFile(media.filePath);
    if (!resolvedMedia) {
      return res.status(404).json({ success: false, message: 'Background media file not found' });
    }

    const ext = path.extname(resolvedMedia).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return res.sendFile(path.resolve(resolvedMedia));
    }

    const baseNameWithoutExt = path.parse(resolvedMedia).name;
    const parentDir = path.dirname(resolvedMedia);
    const possibleThumb = path.join(parentDir, `${baseNameWithoutExt}_thumb.jpg`);

    if (fs.existsSync(possibleThumb)) {
      return res.sendFile(path.resolve(possibleThumb));
    }

    // Attempt to generate on the fly via aiClient
    try {
      await aiClient.generateThumbnail(resolvedMedia, possibleThumb, Math.min(2.0, (media.durationSec || 10) / 2));
      if (fs.existsSync(possibleThumb)) {
        return res.sendFile(path.resolve(possibleThumb));
      }
    } catch {}

    // Fallback: 404
    res.status(404).json({ success: false, message: 'Thumbnail not available' });
  } catch (err) {
    next(err);
  }
});

// POST /api/background-media/:id/set-default - Set as default background media
router.post('/:id/set-default', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.backgroundMedia.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Background media not found' });
    }

    await prisma.backgroundMedia.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    const updated = await prisma.backgroundMedia.update({
      where: { id },
      data: { isDefault: true, isActive: true }
    });

    res.json({
      success: true,
      media: {
        ...updated,
        fileSize: updated.fileSize.toString(),
        previewUrl: `/api/background-media/${updated.id}/preview`,
        thumbnailUrl: `/api/background-media/${updated.id}/thumbnail`
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/background-media/:id - Update background media properties
router.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { title, description, category, isActive, isLoopable, isDefault } = req.body;

    const existing = await prisma.backgroundMedia.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Background media not found' });
    }

    if (isDefault) {
      await prisma.backgroundMedia.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (isLoopable !== undefined) updateData.isLoopable = Boolean(isLoopable);
    if (isDefault !== undefined) updateData.isDefault = Boolean(isDefault);
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (isLoopable !== undefined) updateData.isLoopable = Boolean(isLoopable);

    const updated = await prisma.backgroundMedia.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      media: {
        ...updated,
        fileSize: updated.fileSize.toString(),
        previewUrl: `/api/background-media/${updated.id}/preview`,
        thumbnailUrl: `/api/background-media/${updated.id}/thumbnail`
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/background-media/:id - Delete background media record and files
router.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const media = await prisma.backgroundMedia.findUnique({ where: { id } });
    if (!media) {
      return res.status(404).json({ success: false, message: 'Background media not found' });
    }

    // Remove video file from disk
    const resolvedPath = resolveBackgroundFile(media.filePath);
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      try {
        fs.unlinkSync(resolvedPath);
        logger.info(`Deleted background media file: ${resolvedPath}`);
      } catch (e) {
        logger.warn(`Could not delete background file: ${resolvedPath}`);
      }
    }

    // Remove thumbnail if exists
    if (resolvedPath) {
      const thumbPath = path.join(path.dirname(resolvedPath), `${path.parse(resolvedPath).name}_thumb.jpg`);
      if (fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch {}
      }
    }

    await prisma.backgroundMedia.delete({ where: { id } });

    res.json({ success: true, message: 'Background media deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
