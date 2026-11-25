import path from 'path';
import dotenv from 'dotenv';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8000',
  aiEngineUrl: process.env.AI_ENGINE_URL || 'http://localhost:8001',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'clippilot_jwt_super_secret_key_change_in_production_32chars!',
  jwtExpiresIn: '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  
  // Database & Cache
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clippilot?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Google Gemini & YouTube API
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  youtubeClientId: process.env.YOUTUBE_CLIENT_ID || '',
  youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
  youtubeRedirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:8000/api/youtube/callback',
  
  // Hardware and limits
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '1', 10),
  maxClipsPerSource: parseInt(process.env.MAX_CLIPS_PER_SOURCE || '5', 10),
  maxDailyUploads: parseInt(process.env.MAX_DAILY_UPLOADS || '4', 10),
  
  // Directories
  outputDir: process.env.VIDEO_OUTPUT_DIR || path.resolve(__dirname, '../../../media/output'),
  tempDir: process.env.VIDEO_TEMP_DIR || path.resolve(__dirname, '../../../media/temp'),
  uploadsDir: process.env.VIDEO_UPLOADS_DIR || path.resolve(__dirname, '../../../media/uploads'),
  backgroundsDir: process.env.BACKGROUND_MEDIA_DIR || path.resolve(__dirname, '../../../media/backgrounds'),
  
  // FFmpeg binaries
  ffmpegPath: process.env.FFMPEG_PATH || 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe',
  ffprobePath: process.env.FFPROBE_PATH || 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffprobe.exe'
};
