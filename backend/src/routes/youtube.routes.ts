import { Router } from 'express';
import { prisma } from '../db/prisma';
import { youtubeOAuthService } from '../services/youtube-oauth.service';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { config } from '../config';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/youtube/connect - Direct link to initiate Google OAuth 2.0 flow
router.get('/connect', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user?.id || 'a81622d4-ec40-48b1-aa22-1c94172cef19';
    const { authUrl } = youtubeOAuthService.generateAuthUrl(userId);
    res.redirect(authUrl);
  } catch (err: any) {
    if (err.message?.includes('YOUTUBE_CLIENT_ID')) {
      return res.status(503).json({
        success: false,
        message: 'YouTube OAuth is not configured. Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env file.'
      });
    }
    next(err);
  }
});

// GET /api/youtube/callback - Exchange code for tokens, save account
router.get('/callback', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      logger.warn(`YouTube OAuth error from Google: ${error}`);
      const frontendUrl = config.frontendUrl;
      return res.redirect(`${frontendUrl}/settings?youtube_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'Missing code or state from OAuth callback' });
    }

    const account = await youtubeOAuthService.handleCallback(code, state);

    logger.info(`YouTube account connected via OAuth callback: ${account.channelTitle}`);

    // Redirect to frontend success page
    const frontendUrl = config.frontendUrl;
    return res.redirect(`${frontendUrl}/settings?youtube_connected=true&channel=${encodeURIComponent(account.channelTitle)}`);
  } catch (err: any) {
    logger.error(`YouTube OAuth callback error: ${err.message}`);
    const frontendUrl = config.frontendUrl;
    return res.redirect(`${frontendUrl}/settings?youtube_error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/youtube/status - List connected YouTube accounts for the user
router.get('/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const accounts = await prisma.youTubeAccount.findMany({
      where: { userId },
      select: {
        id: true,
        channelId: true,
        channelTitle: true,
        channelCustomUrl: true,
        channelThumbnail: true,
        isConnected: true,
        tokenExpiry: true,
        scopes: true,
        createdAt: true,
        updatedAt: true
        // Encrypted token fields are intentionally excluded
      }
    });

    res.json({ success: true, accounts });
  } catch (err) {
    next(err);
  }
});

// POST /api/youtube/disconnect - Mark account disconnected
router.post('/disconnect', async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }

    // Verify ownership
    const account = await prisma.youTubeAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return res.status(404).json({ success: false, message: 'YouTube account not found' });
    }

    if (account.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You do not own this YouTube account' });
    }

    await youtubeOAuthService.disconnect(accountId);

    res.json({ success: true, message: 'YouTube account disconnected' });
  } catch (err) {
    next(err);
  }
});

export default router;
