import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { ProviderCredentialRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';

@Injectable()
export class PrismaProviderCredentialRepository implements ProviderCredentialRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async findBestByProvider(providerId: string) {
    const credential = await this.db.providerCredential.findFirst({
      where: { providerId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    if (!credential) return null;
    return { id: credential.id, apiKey: credential.apiKey };
  }
}
