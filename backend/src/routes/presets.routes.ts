import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

export const INITIAL_PRESETS = [
  {
    name: 'Gaming Split Screen',
    description: 'Main gaming footage in upper section with background gameplay below, dynamic animated word-highlight captions, and audio normalization.',
    format: 'SPLIT_SCREEN',
    splitRatio: 0.5,
    captionPreset: 'Dynamic Captions',
    fontName: 'Montserrat',
    fontSize: 64,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H0000FFFF',
    outlineColor: '&H00000000',
    outlineWidth: 3.5,
    position: 'center',
    animationType: 'word_highlight',
    audioNormalization: true,
    isDefault: true,
    cropMode: 'smart',
    subtleZoom: false,
    maxWordsPerLine: 4
  },
  {
    name: 'Full Screen Captions',
    description: 'Smart-cropped 9:16 vertical video with subtle zoom, dynamic popping captions, and bold word-level highlights.',
    format: 'FULL_SCREEN',
    splitRatio: 0.5,
    captionPreset: 'Pop Captions',
    fontName: 'Montserrat',
    fontSize: 68,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H0000FFFF',
    outlineColor: '&H00000000',
    outlineWidth: 4.0,
    position: 'center',
    animationType: 'pop',
    audioNormalization: true,
    isDefault: false,
    cropMode: 'smart',
    subtleZoom: true,
    maxWordsPerLine: 4
  },
  {
    name: 'Streamer Facecam',
    description: 'Main gameplay fills the vertical frame with intelligent facecam detection composited as a picture-in-picture overlay.',
    format: 'FACECAM',
    splitRatio: 0.5,
    captionPreset: 'Dynamic Captions',
    fontName: 'Montserrat',
    fontSize: 62,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H0000FFFF',
    outlineColor: '&H00000000',
    outlineWidth: 3.5,
    position: 'bottom',
    animationType: 'word_highlight',
    facecamPosition: 'top_right',
    facecamSize: 'medium',
    facecamBorderWidth: 4.0,
    facecamBorderColor: '#3B82F6',
    facecamCornerRadius: 20.0,
    audioNormalization: true,
    isDefault: false,
    cropMode: 'smart',
    subtleZoom: false,
    maxWordsPerLine: 4
  },
  {
    name: 'Clean Podcast',
    description: 'Full-screen speaker framing with clear bottom-aligned subtitles, high contrast readability, and minimal visual effects.',
    format: 'FULL_SCREEN',
    splitRatio: 0.5,
    captionPreset: 'Clean Subtitles',
    fontName: 'Arial',
    fontSize: 56,
    primaryColor: '&H00FFFFFF',
    highlightColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    outlineWidth: 3.0,
    position: 'bottom',
    animationType: 'clean',
    audioNormalization: true,
    isDefault: false,
    cropMode: 'smart',
    subtleZoom: false,
    maxWordsPerLine: 5
  }
];

// Helper to seed initial presets if database is empty
async function ensureDefaultPresets() {
  const count = await prisma.editingPreset.count();
  if (count === 0) {
    logger.info('Seeding initial editing presets...');
    for (const p of INITIAL_PRESETS) {
      await prisma.editingPreset.create({
        data: p as any
      });
    }
  }
}

router.use(authMiddleware);

// GET /api/presets - List all editing presets
router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    await ensureDefaultPresets();
    const presets = await prisma.editingPreset.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });

    res.json({ success: true, presets });
  } catch (err) {
    next(err);
  }
});

// GET /api/presets/:id - Get single preset
router.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
    const preset = await prisma.editingPreset.findUnique({ where: { id } });
    if (!preset) {
      return res.status(404).json({ success: false, message: 'Preset not found' });
    }
    res.json({ success: true, preset });
  } catch (err) {
    next(err);
  }
});

// POST /api/presets - Create a new editing preset
router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const {
      name,
      description,
      format,
      splitRatio,
      captionPreset,
      fontName,
      fontSize,
      primaryColor,
      highlightColor,
      outlineColor,
      outlineWidth,
      position,
      animationType,
      audioNormalization,
      isDefault,
      facecamPosition,
      facecamSize,
      facecamBorderWidth,
      facecamBorderColor,
      facecamCornerRadius,
      subtleZoom,
      cropMode,
      maxWordsPerLine
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Preset name is required' });
    }

    // If marked default, unset others first
    if (isDefault) {
      await prisma.editingPreset.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const preset = await prisma.editingPreset.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        format: format || 'SPLIT_SCREEN',
        splitRatio: splitRatio !== undefined ? parseFloat(String(splitRatio)) : 0.5,
        captionPreset: captionPreset || 'Dynamic Captions',
        fontName: fontName || 'Montserrat',
        fontSize: fontSize ? parseInt(String(fontSize), 10) : 64,
        primaryColor: primaryColor || '&H00FFFFFF',
        highlightColor: highlightColor || '&H0000FFFF',
        outlineColor: outlineColor || '&H00000000',
        outlineWidth: outlineWidth ? parseFloat(String(outlineWidth)) : 3.5,
        position: position || 'center',
        animationType: animationType || 'word_highlight',
        audioNormalization: audioNormalization ?? true,
        isDefault: isDefault ?? false,
        facecamPosition: facecamPosition || 'top_right',
        facecamSize: facecamSize || 'medium',
        facecamBorderWidth: facecamBorderWidth ? parseFloat(String(facecamBorderWidth)) : 4.0,
        facecamBorderColor: facecamBorderColor || '#3B82F6',
        facecamCornerRadius: facecamCornerRadius ? parseFloat(String(facecamCornerRadius)) : 20.0,
        subtleZoom: Boolean(subtleZoom),
        cropMode: cropMode || 'smart',
        maxWordsPerLine: maxWordsPerLine ? parseInt(String(maxWordsPerLine), 10) : 4
      }
    });

    logger.info(`Editing preset created: ${name}`);
    res.status(201).json({ success: true, preset });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'A preset with this name already exists' });
    }
    next(err);
  }
});

// PATCH /api/presets/:id - Update preset settings
router.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.editingPreset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Preset not found' });
    }

    const {
      name,
      description,
      format,
      splitRatio,
      captionPreset,
      fontName,
      fontSize,
      primaryColor,
      highlightColor,
      outlineColor,
      outlineWidth,
      position,
      animationType,
      audioNormalization,
      isDefault,
      facecamPosition,
      facecamSize,
      facecamBorderWidth,
      facecamBorderColor,
      facecamCornerRadius,
      subtleZoom,
      cropMode,
      maxWordsPerLine
    } = req.body;

    if (isDefault) {
      await prisma.editingPreset.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (format !== undefined) updateData.format = format;
    if (splitRatio !== undefined) updateData.splitRatio = parseFloat(String(splitRatio));
    if (captionPreset !== undefined) updateData.captionPreset = captionPreset;
    if (fontName !== undefined) updateData.fontName = fontName;
    if (fontSize !== undefined) updateData.fontSize = parseInt(String(fontSize), 10);
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (highlightColor !== undefined) updateData.highlightColor = highlightColor;
    if (outlineColor !== undefined) updateData.outlineColor = outlineColor;
    if (outlineWidth !== undefined) updateData.outlineWidth = parseFloat(String(outlineWidth));
    if (position !== undefined) updateData.position = position;
    if (animationType !== undefined) updateData.animationType = animationType;
    if (audioNormalization !== undefined) updateData.audioNormalization = Boolean(audioNormalization);
    if (isDefault !== undefined) updateData.isDefault = Boolean(isDefault);
    if (facecamPosition !== undefined) updateData.facecamPosition = facecamPosition;
    if (facecamSize !== undefined) updateData.facecamSize = facecamSize;
    if (facecamBorderWidth !== undefined) updateData.facecamBorderWidth = parseFloat(String(facecamBorderWidth));
    if (facecamBorderColor !== undefined) updateData.facecamBorderColor = facecamBorderColor;
    if (facecamCornerRadius !== undefined) updateData.facecamCornerRadius = parseFloat(String(facecamCornerRadius));
    if (subtleZoom !== undefined) updateData.subtleZoom = Boolean(subtleZoom);
    if (cropMode !== undefined) updateData.cropMode = cropMode;
    if (maxWordsPerLine !== undefined) updateData.maxWordsPerLine = parseInt(String(maxWordsPerLine), 10);

    const updated = await prisma.editingPreset.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, preset: updated });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'A preset with this name already exists' });
    }
    next(err);
  }
});

// POST /api/presets/:id/duplicate - Duplicate an existing preset
router.post('/:id/duplicate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.editingPreset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Preset not found' });
    }

    const { id: _, createdAt, updatedAt, ...rest } = existing;
    let newName = `Copy of ${existing.name}`;
    let counter = 1;
    while (await prisma.editingPreset.findUnique({ where: { name: newName } })) {
      counter++;
      newName = `Copy of ${existing.name} (${counter})`;
    }

    const duplicated = await prisma.editingPreset.create({
      data: {
        ...rest,
        name: newName,
        isDefault: false
      }
    });

    logger.info(`Preset duplicated: ${duplicated.name}`);
    res.status(201).json({ success: true, preset: duplicated });
  } catch (err) {
    next(err);
  }
});

// POST /api/presets/:id/set-default - Set as default preset
router.post('/:id/set-default', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.editingPreset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Preset not found' });
    }

    await prisma.editingPreset.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    const updated = await prisma.editingPreset.update({
      where: { id },
      data: { isDefault: true }
    });

    res.json({ success: true, preset: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/presets/:id - Delete a preset
router.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.editingPreset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Preset not found' });
    }

    if (existing.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the default preset. Please set another preset as default first.'
      });
    }

    await prisma.editingPreset.delete({ where: { id } });
    res.json({ success: true, message: 'Preset deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
