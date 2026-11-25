import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

// @ts-ignore
prisma.$on('error', (e: any) => {
  logger.error('Prisma Error:', e);
});

// @ts-ignore
prisma.$on('warn', (e: any) => {
  logger.warn('Prisma Warning:', e);
});
