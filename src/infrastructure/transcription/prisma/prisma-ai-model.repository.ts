import { Injectable, Inject } from '@nestjs/common';
import { IaCategoryKind } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import { AiModelRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';

@Injectable()
export class PrismaAiModelRepository implements AiModelRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async findActiveOrdered() {
    const models = await this.db.aiModel.findMany({
      where: {
        isActive: true,
        provider: { isActive: true },
      },
      include: { provider: true },
      orderBy: { createdAt: 'asc' },
    });
    return models.map((m) => ({
      id: m.id,
      providerId: m.providerId,
      providerName: m.provider.name as ProviderName,
      modelName: m.modelName,
    }));
  }

  async findActiveTextGenerationByProviderId(providerId: string) {
    const models = await this.db.aiModel.findMany({
      where: {
        isActive: true,
        providerId,
        category: { tipo: IaCategoryKind.TEXT_GENERATION },
      },
      include: { provider: true },
      orderBy: { createdAt: 'asc' },
    });
    return models.map((m) => ({
      id: m.id,
      providerId: m.providerId,
      providerName: m.provider.name as ProviderName,
      modelName: m.modelName,
    }));
  }
}
