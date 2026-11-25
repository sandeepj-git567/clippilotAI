import { Router, Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { prisma } from '../db/prisma';
import { authService } from '../services/auth.service';
import { config } from '../config';
import { logger } from '../config/logger';

const router = Router();

// Helper to get Google OAuth2 Client
function getGoogleAuthClient(customRedirectUri?: string) {
  const redirectUri = customRedirectUri || `${config.backendUrl}/api/auth/google/callback`;
  return new google.auth.OAuth2(
    config.youtubeClientId,
    config.youtubeClientSecret,
    redirectUri
  );
}

/**
 * GET /api/auth/google/url
 * Returns authorization URL for Google OAuth 2.0 Sign-in / Sign-up
 */
router.get('/google/url', (req: Request, res: Response) => {
  try {
    if (!config.youtubeClientId || !config.youtubeClientSecret) {
      return res.status(500).json({
        success: false,
        message: 'Google OAuth is not configured. Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET.'
      });
    }

    const oauth2Client = getGoogleAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account',
      scope: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    });

    res.json({ success: true, authUrl });
  } catch (err: any) {
    logger.error('Failed to generate Google auth URL', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback redirect, provisions user, and redirects to frontend with JWT
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query;

    if (error) {
      logger.warn(`Google auth rejected by user: ${error}`);
      return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(error))}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/login?error=missing_authorization_code`);
    }

    const oauth2Client = getGoogleAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return res.redirect(`${config.frontendUrl}/login?error=email_not_provided`);
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(profile.id ? [{ googleId: profile.id }] : []),
          { email: profile.email }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          googleId: profile.id,
          avatarUrl: profile.picture || null,
          role: 'USER'
        }
      });

      // Default automation settings for new user
      await prisma.automationSettings.create({
        data: {
          userId: user.id,
          autoPublishEnabled: false,
          maxDailyUploads: 4,
          preferredPostingTimes: ['10:00', '14:00', '18:00', '21:00'],
          timezone: 'Asia/Kolkata',
          paused: false
        }
      });
      logger.info(`New user registered via Google OAuth: ${user.email} (${user.id})`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id || user.googleId,
          avatarUrl: profile.picture || user.avatarUrl,
          name: profile.name || user.name
        }
      });
      logger.info(`User logged in via Google OAuth: ${user.email} (${user.id})`);
    }

    const token = authService.generateToken(user);
    res.redirect(`${config.frontendUrl}/?token=${token}&auth=success`);
  } catch (err: any) {
    logger.error('Google OAuth callback failed', err);
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(err.message || 'auth_failed')}`);
  }
});

/**
 * POST /api/auth/google/verify
 * Verifies Google One-Tap ID token or client credentials
 */
router.post('/google/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential token is required' });
    }

    const oauth2Client = getGoogleAuthClient();
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: config.youtubeClientId
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google credential token' });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(payload.sub ? [{ googleId: payload.sub }] : []),
          { email: payload.email }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          googleId: payload.sub,
          avatarUrl: payload.picture || null,
          role: 'USER'
        }
      });

      await prisma.automationSettings.create({
        data: {
          userId: user.id,
          autoPublishEnabled: false,
          maxDailyUploads: 4,
          preferredPostingTimes: ['10:00', '14:00', '18:00', '21:00'],
          timezone: 'Asia/Kolkata',
          paused: false
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub || user.googleId,
          avatarUrl: payload.picture || user.avatarUrl,
          name: payload.name || user.name
        }
      });
    }

    const token = authService.generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/register
 * Standard email + password registration
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await authService.hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
        role: 'USER'
      }
    });

    await prisma.automationSettings.create({
      data: {
        userId: user.id,
        autoPublishEnabled: false,
        maxDailyUploads: 4,
        preferredPostingTimes: ['10:00', '14:00', '18:00', '21:00'],
        timezone: 'Asia/Kolkata',
        paused: false
      }
    });

    const token = authService.generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Standard email + password login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: 'This account was created via Google Sign-In. Please sign in with Google.'
      });
    }

    const isValid = await authService.comparePassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = authService.generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
router.get('/me', async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = req.user
      ? await prisma.user.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            createdAt: true
          }
        })
      : await authService.getOrCreateDefaultUser();

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

export default router;
