import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import {
  ProviderCredentialAdminRepository,
  ProviderCredentialRecord,
} from '@app/protocols/transcription/repositories/admin-transcription.repository';

@Injectable()
export class PrismaProviderCredentialAdminRepository implements ProviderCredentialAdminRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async listByProvider(
    providerId: string,
  ): Promise<ProviderCredentialRecord[]> {
    const items = await this.db.providerCredential.findMany({
      where: { providerId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return items.map((item) => this.toRecord(item));
  }

  async create(data: {
    providerId: string;
    name: string;
    apiKey: string;
    isActive?: boolean;
    priority?: number;
  }): Promise<ProviderCredentialRecord> {
    const item = await this.db.providerCredential.create({
      data: {
        providerId: data.providerId,
        name: data.name,
        apiKey: data.apiKey,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      },
    });
    return this.toRecord(item);
  }

  async update(
    id: string,
    data: {
      name?: string;
      apiKey?: string;
      isActive?: boolean;
      priority?: number;
    },
  ): Promise<ProviderCredentialRecord> {
    const item = await this.db.providerCredential.update({
      where: { id },
      data: {
        name: data.name,
        apiKey: data.apiKey,
        isActive: data.isActive,
        priority: data.priority,
      },
    });
    return this.toRecord(item);
  }

  async delete(id: string): Promise<void> {
    await this.db.providerCredential.delete({ where: { id } });
  }

  private toRecord(p: {
    id: string;
    providerId: string;
    name: string;
    apiKey: string;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
  }): ProviderCredentialRecord {
    return {
      id: p.id,
      providerId: p.providerId,
      name: p.name,
      apiKey: p.apiKey,
      isActive: p.isActive,
      priority: p.priority,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
