import { prisma } from '../db/prisma';
import { logger } from '../config/logger';

export interface RightsVerificationInput {
  sourceVideoId: string;
  rightsHolder: string;
  permissionStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  licenceType: 'USER_OWNED' | 'CREATOR_AUTHORIZED' | 'CREATIVE_COMMONS' | 'PUBLIC_DOMAIN' | 'OTHER';
  canEdit: boolean;
  canRepublish: boolean;
  canCommercialize: boolean;
  attributionRequired: boolean;
  attributionText?: string;
  evidenceNotes?: string;
  verifiedBy?: string;
}

export class RightsService {
  /**
   * Enforces Section 7 Rights Management rules:
   * Block processing and publishing if required rights are missing or uncertain.
   */
  async createOrUpdateRights(input: RightsVerificationInput) {
    logger.info(`Validating rights for video: ${input.sourceVideoId}, status: ${input.permissionStatus}`);

    const isAuthorized =
      input.permissionStatus === 'VERIFIED' &&
      input.canEdit === true &&
      input.canRepublish === true;

    const record = await prisma.rightsRecord.upsert({
      where: { sourceVideoId: input.sourceVideoId },
      create: {
        sourceVideoId: input.sourceVideoId,
        rightsHolder: input.rightsHolder,
        permissionStatus: input.permissionStatus,
        licenceType: input.licenceType,
        canEdit: input.canEdit,
        canRepublish: input.canRepublish,
        canCommercialize: input.canCommercialize,
        attributionRequired: input.attributionRequired,
        attributionText: input.attributionText,
        evidenceNotes: input.evidenceNotes,
        verifiedAt: isAuthorized ? new Date() : null,
        verifiedBy: input.verifiedBy
      },
      update: {
        rightsHolder: input.rightsHolder,
        permissionStatus: input.permissionStatus,
        licenceType: input.licenceType,
        canEdit: input.canEdit,
        canRepublish: input.canRepublish,
        canCommercialize: input.canCommercialize,
        attributionRequired: input.attributionRequired,
        attributionText: input.attributionText,
        evidenceNotes: input.evidenceNotes,
        verifiedAt: isAuthorized ? new Date() : null,
        verifiedBy: input.verifiedBy
      }
    });

    return {
      record,
      isAuthorized
    };
  }

  async verifyCanPublish(sourceVideoId: string): Promise<boolean> {
    const rights = await prisma.rightsRecord.findUnique({
      where: { sourceVideoId }
    });

    if (!rights) return false;
    return rights.permissionStatus === 'VERIFIED' && rights.canEdit && rights.canRepublish;
  }
}

export const rightsService = new RightsService();
