import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
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
      providerName: m.provider.name,
      modelName: m.modelName,
    }));
  }
}
