import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = config.uploadsDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    const uniqueName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${safeExt}`;
    cb(null, uniqueName);
  }
});

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/avi'
];

export const uploadVideoMiddleware = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2 GB max
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|mkv|avi)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Supported formats: MP4, WebM, MOV, MKV, AVI.'));
    }
  }
});
