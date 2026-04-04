import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import {
  AiModelAdminRepository,
  AiModelRecord,
  IaCategoryTipoCode,
  IaCategoryRecord,
  ProviderRecord,
} from '@app/protocols/transcription/repositories/admin-transcription.repository';

@Injectable()
export class PrismaAiModelAdminRepository implements AiModelAdminRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async list(): Promise<
    Array<
      AiModelRecord & {
        provider: ProviderRecord;
        category: IaCategoryRecord | null;
      }
    >
  > {
    const items = await this.db.aiModel.findMany({
      include: { provider: true, category: true },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((m) => ({
      ...this.toRecord(m),
      provider: {
        id: m.provider.id,
        name: m.provider.name,
        displayName: m.provider.displayName,
        isActive: m.provider.isActive,
        createdAt: m.provider.createdAt,
        updatedAt: m.provider.updatedAt,
      },
      category: m.category
        ? {
            id: m.category.id,
            name: m.category.name,
            tipo: m.category.tipo as IaCategoryTipoCode,
            createdAt: m.category.createdAt,
            updatedAt: m.category.updatedAt,
          }
        : null,
    }));
  }

  async create(data: {
    providerId: string;
    categoryId?: string | null;
    name: string;
    modelName: string;
    subtitle?: string | null;
    textTooltip?: string | null;
    urlIcone?: string | null;
    iconFileName?: string | null;
    type?: string;
    isActive?: boolean;
  }): Promise<AiModelRecord> {
    const item = await this.db.aiModel.create({
      data: {
        providerId: data.providerId,
        categoryId: data.categoryId ?? null,
        name: data.name,
        modelName: data.modelName,
        subtitle: data.subtitle ?? null,
        textTooltip: data.textTooltip ?? null,
        urlIcone: data.urlIcone ?? null,
        iconFileName: data.iconFileName ?? null,
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
      categoryId?: string | null;
      name?: string;
      modelName?: string;
      subtitle?: string | null;
      textTooltip?: string | null;
      urlIcone?: string | null;
      iconFileName?: string | null;
      type?: string;
      isActive?: boolean;
    },
  ): Promise<AiModelRecord> {
    const item = await this.db.aiModel.update({
      where: { id },
      data: {
        ...(data.providerId !== undefined && { providerId: data.providerId }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.modelName !== undefined && { modelName: data.modelName }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
        ...(data.textTooltip !== undefined && {
          textTooltip: data.textTooltip,
        }),
        ...(data.urlIcone !== undefined && { urlIcone: data.urlIcone }),
        ...(data.iconFileName !== undefined && {
          iconFileName: data.iconFileName,
        }),
        ...(data.type !== undefined && { type: data.type as 'TRANSCRIPTION' }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
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
    categoryId: string | null;
    name: string;
    modelName: string;
    subtitle: string | null;
    textTooltip: string | null;
    urlIcone: string | null;
    iconFileName: string | null;
    type: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AiModelRecord {
    return {
      id: m.id,
      providerId: m.providerId,
      categoryId: m.categoryId,
      name: m.name,
      modelName: m.modelName,
      subtitle: m.subtitle,
      textTooltip: m.textTooltip,
      urlIcone: m.urlIcone,
      iconFileName: m.iconFileName,
      type: m.type,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }
}
