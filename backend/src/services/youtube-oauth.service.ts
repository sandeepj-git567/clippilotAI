import { google } from 'googleapis';
import { config } from '../config';
import { prisma } from '../db/prisma';
import { encryptionService } from './encryption.service';
import { logger } from '../config/logger';

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

export class YouTubeOAuthService {
  private getOAuthClient() {
    if (!config.youtubeClientId || !config.youtubeClientSecret) {
      throw new Error(
        'YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are not configured. Please configure them in your .env file.'
      );
    }
    return new google.auth.OAuth2(
      config.youtubeClientId,
      config.youtubeClientSecret,
      config.youtubeRedirectUri
    );
  }

  /**
   * Generates secure Google OAuth 2.0 authorization URL with anti-CSRF state token.
   */
  generateAuthUrl(userId: string): { authUrl: string; state: string } {
    const oauth2Client = this.getOAuthClient();
    const state = JSON.stringify({
      userId,
      nonce: Math.random().toString(36).substring(2),
      time: Date.now()
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Demands refresh_token
      prompt: 'consent',     // Demands refresh_token even if previously granted
      scope: YOUTUBE_SCOPES,
      state: Buffer.from(state).toString('base64url')
    });

    return { authUrl, state };
  }

  /**
   * Exchanges authorization code for tokens, retrieves YouTube Channel details,
   * encrypts sensitive tokens at rest, and persists account.
   */
  async handleCallback(code: string, encodedState: string) {
    let stateData: any;
    try {
      const decoded = Buffer.from(encodedState, 'base64url').toString('utf8');
      stateData = JSON.parse(decoded);
    } catch {
      throw new Error('Invalid or corrupted OAuth state parameter');
    }

    const { userId } = stateData;
    if (!userId) {
      throw new Error('Missing userId in OAuth state');
    }

    const oauth2Client = this.getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token) {
      throw new Error('Did not receive access_token from Google OAuth');
    }

    // Retrieve YouTube channel profile
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ['snippet', 'id'],
      mine: true
    });

    const channel = channelRes.data.items?.[0];
    if (!channel || !channel.id) {
      throw new Error('No YouTube channel found for this Google account.');
    }

    const channelId = channel.id;
    const channelTitle = channel.snippet?.title || 'YouTube Channel';
    const channelCustomUrl = channel.snippet?.customUrl || null;
    const channelThumbnail = channel.snippet?.thumbnails?.default?.url || null;

    // Encrypt tokens at rest
    const encryptedAccess = encryptionService.encrypt(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token
      ? encryptionService.encrypt(tokens.refresh_token)
      : '';

    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Upsert YouTube account record
    const account = await prisma.youTubeAccount.upsert({
      where: { channelId },
      create: {
        userId,
        channelId,
        channelTitle,
        channelCustomUrl,
        channelThumbnail,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        tokenExpiry: expiryDate,
        scopes: YOUTUBE_SCOPES,
        isConnected: true
      },
      update: {
        userId,
        channelTitle,
        channelCustomUrl,
        channelThumbnail,
        encryptedAccessToken: encryptedAccess,
        ...(encryptedRefresh ? { encryptedRefreshToken: encryptedRefresh } : {}),
        tokenExpiry: expiryDate,
        isConnected: true
      }
    });

    logger.info(`YouTube channel connected: ${channelTitle} (${channelId})`);
    return account;
  }

  /**
   * Retrieves an authenticated OAuth2Client, automatically refreshing the token if expired.
   */
  async getAuthenticatedClient(accountId: string) {
    const account = await prisma.youTubeAccount.findUnique({
      where: { id: accountId }
    });

    if (!account || !account.isConnected) {
      throw new Error('YouTube account is not connected or not found.');
    }

    const oauth2Client = this.getOAuthClient();
    const accessToken = encryptionService.decrypt(account.encryptedAccessToken);
    const refreshToken = account.encryptedRefreshToken
      ? encryptionService.decrypt(account.encryptedRefreshToken)
      : undefined;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: account.tokenExpiry.getTime()
    });

    // Check if token expired or about to expire in next 2 minutes
    if (account.tokenExpiry.getTime() - Date.now() < 2 * 60 * 1000) {
      if (!refreshToken) {
        throw new Error('OAuth token expired and no refresh token is stored. Please reconnect your YouTube account.');
      }

      logger.info(`Refreshing expired OAuth token for channel: ${account.channelTitle}`);
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        const newEncryptedAccess = encryptionService.encrypt(credentials.access_token);
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000);

        await prisma.youTubeAccount.update({
          where: { id: accountId },
          data: {
            encryptedAccessToken: newEncryptedAccess,
            tokenExpiry: newExpiry
          }
        });
      }
    }

    return oauth2Client;
  }

  async disconnect(accountId: string) {
    await prisma.youTubeAccount.update({
      where: { id: accountId },
      data: { isConnected: false }
    });
    logger.info(`Disconnected YouTube account: ${accountId}`);
  }
}

export const youtubeOAuthService = new YouTubeOAuthService();
