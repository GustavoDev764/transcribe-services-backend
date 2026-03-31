import { Injectable, Inject } from '@nestjs/common';
import { ProviderName } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import {
  ProviderAdminRepository,
  ProviderRecord,
} from '@app/protocols/transcription/repositories/admin-transcription.repository';

@Injectable()
export class PrismaProviderAdminRepository implements ProviderAdminRepository {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
  ) {}

  async list(): Promise<ProviderRecord[]> {
    const items = await this.db.provider.findMany({
      orderBy: { createdAt: 'asc' as const },
    });
    return items.map(this.toRecord);
  }

  async create(data: { name: string; isActive?: boolean }): Promise<ProviderRecord> {
    const item = await this.db.provider.create({
      data: {
        name: data.name as ProviderName,
        isActive: data.isActive ?? true,
      },
    });
    return this.toRecord(item);
  }

  async update(
    id: string,
    data: { name?: string; isActive?: boolean },
  ): Promise<ProviderRecord> {
    const item = await this.db.provider.update({
      where: { id },
      data: {
        name: data.name as ProviderName | undefined,
        isActive: data.isActive,
      },
    });
    return this.toRecord(item);
  }

  async delete(id: string): Promise<void> {
    await this.db.provider.delete({ where: { id } });
  }

  async deactivateAll(): Promise<void> {
    await this.db.provider.updateMany({ data: { isActive: false } });
  }

  async deactivateAllExcept(id: string): Promise<void> {
    await this.db.provider.updateMany({
      where: { NOT: { id } },
      data: { isActive: false },
    });
  }

  private toRecord(p: {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ProviderRecord {
    return {
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
