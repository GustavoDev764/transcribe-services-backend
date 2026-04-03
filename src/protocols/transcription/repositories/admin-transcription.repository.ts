export interface ProviderRecord {
  id: string;
  name: string;
  displayName: string | null;
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

export type IaCategoryTipoCode = 'TEXT_GENERATION' | 'AUDIO_AND_SPEECH';

export interface IaCategoryRecord {
  id: string;
  name: string;
  tipo: IaCategoryTipoCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiModelRecord {
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
}

export interface ProviderAdminRepository {
  list(): Promise<ProviderRecord[]>;
  create(data: {
    name: string;
    displayName?: string | null;
    isActive?: boolean;
  }): Promise<ProviderRecord>;
  update(
    id: string,
    data: {
      name?: string;
      displayName?: string | null;
      isActive?: boolean;
    },
  ): Promise<ProviderRecord>;
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
    data: {
      name?: string;
      apiKey?: string;
      isActive?: boolean;
      priority?: number;
    },
  ): Promise<ProviderCredentialRecord>;
  delete(id: string): Promise<void>;
}

export interface AiModelAdminRepository {
  list(): Promise<
    Array<
      AiModelRecord & {
        provider: ProviderRecord;
        category: IaCategoryRecord | null;
      }
    >
  >;
  create(data: {
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
  }): Promise<AiModelRecord>;
  update(
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
  ): Promise<AiModelRecord>;
  delete(id: string): Promise<void>;
}

export interface IaCategoryAdminRepository {
  list(): Promise<IaCategoryRecord[]>;
  create(data: {
    name: string;
    tipo: IaCategoryTipoCode;
  }): Promise<IaCategoryRecord>;
  update(
    id: string,
    data: { name?: string; tipo?: IaCategoryTipoCode },
  ): Promise<IaCategoryRecord>;
  delete(id: string): Promise<void>;
}
