import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { config } from '../config';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(user: { id: string; email: string; role: string }): string {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  async getOrCreateDefaultUser() {
    const defaultEmail = 'creator@clippilot.ai';
    let user = await prisma.user.findUnique({
      where: { email: defaultEmail }
    });

    if (!user) {
      const passwordHash = await this.hashPassword('clippilot123');
      user = await prisma.user.create({
        data: {
          email: defaultEmail,
          name: 'ClipPilot Creator',
          passwordHash,
          role: 'ADMIN'
        }
      });

      // Create default automation settings
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
    }

    return user;
  }
}

export const authService = new AuthService();
