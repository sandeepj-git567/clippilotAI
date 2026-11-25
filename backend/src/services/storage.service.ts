import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../config/logger';

export class StorageService {
  /**
   * Cleans up temporary processing files older than maxAgeHours.
   * Preserves completed output videos.
   */
  cleanupTempFiles(maxAgeHours: number = 24) {
    const tempDir = config.tempDir;
    if (!fs.existsSync(tempDir)) return;

    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    fs.readdir(tempDir, (err, files) => {
      if (err) return;
      for (const file of files) {
        if (file === '.gitkeep') continue;
        const filePath = path.join(tempDir, file);
        fs.stat(filePath, (statErr, stats) => {
          if (!statErr && now - stats.mtimeMs > maxAgeMs) {
            fs.unlink(filePath, (unlinkErr) => {
              if (!unlinkErr) logger.info(`Cleaned up temp file: ${filePath}`);
            });
          }
        });
      }
    });
  }
}

export const storageService = new StorageService();
