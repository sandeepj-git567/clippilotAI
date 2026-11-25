import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../config/logger';

export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 500, 2000);
    return delay;
  }
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis server');
});

redisConnection.on('error', (err) => {
  logger.warn(`Redis connection warning: ${err.message}`);
});

export const videoProcessingQueue = new Queue('video-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});
