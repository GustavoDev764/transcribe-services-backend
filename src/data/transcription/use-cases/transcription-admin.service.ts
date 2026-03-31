import { Injectable, Inject } from '@nestjs/common';
import type { ProviderAdminRepository } from '@app/protocols/transcription/repositories/admin-transcription.repository';
import type { ProviderCredentialAdminRepository } from '@app/protocols/transcription/repositories/admin-transcription.repository';
import type { AiModelAdminRepository } from '@app/protocols/transcription/repositories/admin-transcription.repository';
import { CreateProviderDto } from '@app/presentation/transcription/requests/admin/create-provider.dto';
import { CreateCredentialDto } from '@app/presentation/transcription/requests/admin/create-credential.dto';
import { CreateModelDto } from '@app/presentation/transcription/requests/admin/create-model.dto';

export const TRANSCRIPTION_ADMIN_TOKENS = {
  ProviderRepository: Symbol('TranscriptionAdmin.ProviderRepository'),
  ProviderCredentialRepository: Symbol(
    'TranscriptionAdmin.ProviderCredentialRepository',
  ),
  AiModelRepository: Symbol('TranscriptionAdmin.AiModelRepository'),
} as const;

@Injectable()
export class TranscriptionAdminService {
  constructor(
    @Inject(TRANSCRIPTION_ADMIN_TOKENS.ProviderRepository)
    private readonly providerRepo: ProviderAdminRepository,
    @Inject(TRANSCRIPTION_ADMIN_TOKENS.ProviderCredentialRepository)
    private readonly credentialRepo: ProviderCredentialAdminRepository,
    @Inject(TRANSCRIPTION_ADMIN_TOKENS.AiModelRepository)
    private readonly aiModelRepo: AiModelAdminRepository,
  ) {}

  listProviders() {
    return this.providerRepo.list();
  }

  async createProvider(dto: CreateProviderDto) {
    const isActive = dto.isActive ?? true;
    if (isActive) {
      await this.providerRepo.deactivateAll();
    }
    return this.providerRepo.create({
      name: dto.name,
      isActive,
    });
  }

  async updateProvider(id: string, dto: CreateProviderDto) {
    if (dto.isActive === true) {
      await this.providerRepo.deactivateAllExcept(id);
    }
    return this.providerRepo.update(id, {
      name: dto.name,
      isActive: dto.isActive,
    });
  }

  deleteProvider(id: string) {
    return this.providerRepo.delete(id);
  }

  listCredentials(providerId: string) {
    return this.credentialRepo.listByProvider(providerId);
  }

  createCredential(providerId: string, dto: CreateCredentialDto) {
    return this.credentialRepo.create({
      providerId,
      name: dto.name,
      apiKey: dto.apiKey?.trim() ?? '',
      isActive: dto.isActive ?? true,
      priority: dto.priority ?? 0,
    });
  }

  updateCredential(id: string, dto: Partial<CreateCredentialDto>) {
    return this.credentialRepo.update(id, {
      name: dto.name,
      apiKey: dto.apiKey,
      isActive: dto.isActive,
      priority: dto.priority,
    });
  }

  deleteCredential(id: string) {
    return this.credentialRepo.delete(id);
  }

  listModels() {
    return this.aiModelRepo.list();
  }

  createModel(dto: CreateModelDto) {
    return this.aiModelRepo.create({
      providerId: dto.providerId,
      name: dto.name,
      modelName: dto.modelName,
      type: dto.type ?? 'TRANSCRIPTION',
      isActive: dto.isActive ?? true,
    });
  }

  updateModel(id: string, dto: Partial<CreateModelDto>) {
    return this.aiModelRepo.update(id, {
      providerId: dto.providerId,
      name: dto.name,
      modelName: dto.modelName,
      type: dto.type,
      isActive: dto.isActive,
    });
  }

  deleteModel(id: string) {
    return this.aiModelRepo.delete(id);
  }
}
