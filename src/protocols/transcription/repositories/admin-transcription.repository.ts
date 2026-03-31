export interface ProviderRecord {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderCredentialRecord {
  id: string;
  providerId: string;
  name: string;
  apiKey: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiModelRecord {
  id: string;
  providerId: string;
  name: string;
  modelName: string;
  type: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderAdminRepository {
  list(): Promise<ProviderRecord[]>;
  create(data: { name: string; isActive?: boolean }): Promise<ProviderRecord>;
  update(id: string, data: { name?: string; isActive?: boolean }): Promise<ProviderRecord>;
  delete(id: string): Promise<void>;
  deactivateAll(): Promise<void>;
  deactivateAllExcept(id: string): Promise<void>;
}

export interface ProviderCredentialAdminRepository {
  listByProvider(providerId: string): Promise<ProviderCredentialRecord[]>;
  create(data: {
    providerId: string;
    name: string;
    apiKey: string;
    isActive?: boolean;
    priority?: number;
  }): Promise<ProviderCredentialRecord>;
  update(
    id: string,
    data: { name?: string; apiKey?: string; isActive?: boolean; priority?: number },
  ): Promise<ProviderCredentialRecord>;
  delete(id: string): Promise<void>;
}

export interface AiModelAdminRepository {
  list(): Promise<Array<AiModelRecord & { provider: ProviderRecord }>>;
  create(data: {
    providerId: string;
    name: string;
    modelName: string;
    type?: string;
    isActive?: boolean;
  }): Promise<AiModelRecord>;
  update(
    id: string,
    data: {
      providerId?: string;
      name?: string;
      modelName?: string;
      type?: string;
      isActive?: boolean;
    },
  ): Promise<AiModelRecord>;
  delete(id: string): Promise<void>;
}
