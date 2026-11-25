import { Router } from 'express';
import { prisma } from '../db/prisma';
import { videoProcessingQueue } from '../queue/queue';

const router = Router();

// GET /api/jobs - List background processing jobs
router.get('/', async (req, res, next) => {
  try {
    const jobs = await prisma.processingJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourceVideo: {
          select: { id: true, title: true, editingFormat: true, originalFilename: true }
        }
      },
      take: 100
    });
    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id - Single job status
router.get('/:id', async (req, res, next) => {
  try {
    const job = await prisma.processingJob.findUnique({
      where: { id: req.params.id },
      include: { sourceVideo: true }
    });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    
    const serializedJob = {
      ...job,
      sourceVideo: job.sourceVideo ? {
        ...job.sourceVideo,
        fileSize: job.sourceVideo.fileSize ? job.sourceVideo.fileSize.toString() : null
      } : null
    };

    res.json({ success: true, job: serializedJob });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const job = await prisma.processingJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    await prisma.processingJob.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        currentStage: 'Cancelled by user'
      }
    });

    res.json({ success: true, message: 'Job cancelled' });
  } catch (err) {
    next(err);
  }
});

export default router;
