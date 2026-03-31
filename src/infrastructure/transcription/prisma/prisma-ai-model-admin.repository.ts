import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import {
  AiModelAdminRepository,
  AiModelRecord,
  ProviderRecord,
} from '@app/protocols/transcription/repositories/admin-transcription.repository';

@Injectable()
export class PrismaAiModelAdminRepository implements AiModelAdminRepository {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
  ) {}

  async list(): Promise<Array<AiModelRecord & { provider: ProviderRecord }>> {
    const items = await this.db.aiModel.findMany({
      include: { provider: true },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((m) => ({
      ...this.toRecord(m),
      provider: {
        id: m.provider.id,
        name: m.provider.name,
        isActive: m.provider.isActive,
        createdAt: m.provider.createdAt,
        updatedAt: m.provider.updatedAt,
      },
    }));
  }

  async create(data: {
    providerId: string;
    name: string;
    modelName: string;
    type?: string;
    isActive?: boolean;
  }): Promise<AiModelRecord> {
    const item = await this.db.aiModel.create({
      data: {
        providerId: data.providerId,
        name: data.name,
        modelName: data.modelName,
        type: (data.type as 'TRANSCRIPTION') ?? 'TRANSCRIPTION',
        isActive: data.isActive ?? true,
      },
    });
    return this.toRecord(item);
  }

  async update(
    id: string,
    data: {
      providerId?: string;
      name?: string;
      modelName?: string;
      type?: string;
      isActive?: boolean;
    },
  ): Promise<AiModelRecord> {
    const item = await this.db.aiModel.update({
      where: { id },
      data: {
        providerId: data.providerId,
        name: data.name,
        modelName: data.modelName,
        type: data.type as 'TRANSCRIPTION' | undefined,
        isActive: data.isActive,
      },
    });
    return this.toRecord(item);
  }

  async delete(id: string): Promise<void> {
    await this.db.aiModel.delete({ where: { id } });
  }

  private toRecord(m: {
    id: string;
    providerId: string;
    name: string;
    modelName: string;
    type: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AiModelRecord {
    return {
      id: m.id,
      providerId: m.providerId,
      name: m.name,
      modelName: m.modelName,
      type: m.type,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }
}
