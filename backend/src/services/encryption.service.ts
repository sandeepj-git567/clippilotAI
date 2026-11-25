import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts and decrypts sensitive OAuth tokens at rest using AES-256-GCM.
 * Never stores refresh tokens in plain text.
 */
export class EncryptionService {
  private key: Buffer;

  constructor() {
    // 32 bytes key from hex or padded string
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (hexRegex.test(config.encryptionKey)) {
      this.key = Buffer.from(config.encryptionKey, 'hex');
    } else {
      this.key = crypto.createHash('sha256').update(config.encryptionKey).digest();
    }
  }

  encrypt(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(cipherTextWithMeta: string): string {
    if (!cipherTextWithMeta) return '';
    const parts = cipherTextWithMeta.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const encryptionService = new EncryptionService();
