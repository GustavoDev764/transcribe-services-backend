import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { UsageLogRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';

@Injectable()
export class PrismaUsageLogRepository implements UsageLogRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async create(data: {
    providerId: string;
    providerCredentialId?: string | null;
    aiModelId?: string | null;
    tokens?: number | null;
    costTotal?: number | null;
    status: TranscriptionStatus;
    errorMessage?: string | null;
  }) {
    await this.db.aiUsageLog.create({
      data: {
        providerId: data.providerId,
        providerCredentialId: data.providerCredentialId ?? null,
        aiModelId: data.aiModelId ?? null,
        tokens: data.tokens ?? null,
        costTotal: data.costTotal ?? null,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
      },
    });
  }
}
