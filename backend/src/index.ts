import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import { videoProcessingWorker } from './queue/worker';
import { redisConnection } from './queue/queue';
import { storageService } from './services/storage.service';
import { authService } from './services/auth.service';

let server: http.Server;
let cleanupInterval: NodeJS.Timeout;

async function startServer(): Promise<void> {
  // Ensure default user exists
  await authService.getOrCreateDefaultUser();
  logger.info('Default user verified');

  // Start BullMQ worker
  await videoProcessingWorker.start();
  logger.info('Video processing worker started');

  // Start HTTP server
  server = app.listen(config.port, () => {
    logger.info(`ClipPilot AI Backend running on port ${config.port}`);
  });

  // Periodic temp file cleanup every 60 seconds (files older than 24 hours)
  cleanupInterval = setInterval(async () => {
    try {
      await storageService.cleanupTempFiles(24);
    } catch (err) {
      logger.error('Temp file cleanup failed', err);
    }
  }, 60 * 1000);
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Clear cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  try {
    // Stop the BullMQ worker
    await videoProcessingWorker.stop();
    logger.info('Video processing worker stopped');

    // Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Prisma disconnected');

    // Disconnect Redis
    await redisConnection.quit();
    logger.info('Redis disconnected');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', err);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
