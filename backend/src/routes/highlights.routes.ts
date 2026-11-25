import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

// GET /api/highlights/:videoId - Get AI-generated highlight candidates for a video
router.get('/:videoId', async (req, res, next) => {
  try {
    const highlights = await prisma.highlight.findMany({
      where: { sourceVideoId: req.params.videoId },
      orderBy: { overallScore: 'desc' },
      include: { clips: true }
    });
    res.json({ success: true, highlights });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/highlights/:id/toggle - Toggle selection of highlight for rendering
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const hl = await prisma.highlight.findUnique({ where: { id: req.params.id } });
    if (!hl) return res.status(404).json({ success: false, message: 'Highlight not found' });

    const updated = await prisma.highlight.update({
      where: { id: req.params.id },
      data: { isSelected: !hl.isSelected }
    });

    res.json({ success: true, highlight: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
