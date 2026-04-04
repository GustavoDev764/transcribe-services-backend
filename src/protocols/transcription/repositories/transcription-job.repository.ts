import { ProviderAttempt } from '@app/domain/transcription/entities/transcription-job.entity';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';

export type TranscriptionJobRecord = {
  id: string;
  fileId?: string | null;
  fileUrl: string;
  provider?: string | null;
  externalJobId?: string | null;
  preferredModel?: string | null;
  diarizeEnabled?: boolean;
  diarizeSpeakerCount?: number | null;
  status: TranscriptionStatus;
  providerAttempts: ProviderAttempt[];
  responses?: unknown;
  resultUrl?: string | null;
  errorMessage?: string | null;
  attempts?: number;
  lastStatusCheckAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface TranscriptionJobRepository {
  create(data: {
    fileId?: string | null;
    fileUrl: string;
    provider?: string | null;
    externalJobId?: string | null;
    preferredModel?: string | null;
    diarizeEnabled?: boolean;
    diarizeSpeakerCount?: number | null;
  }): Promise<TranscriptionJobRecord>;
  findById(id: string): Promise<TranscriptionJobRecord | null>;
  findPendingExternalSyncJobsByFileIds(
    fileIds: string[],
    minLastCheckBefore: Date,
  ): Promise<Array<{ id: string }>>;
  updateStatus(
    id: string,
    status: TranscriptionStatus,
    data?: {
      providerAttempts?: ProviderAttempt[];
      responses?: unknown;
      resultUrl?: string | null;
      errorMessage?: string | null;
      externalJobId?: string | null;
      provider?: string | null;
      lastStatusCheckAt?: Date | null;
      attemptsIncrement?: boolean;
      finishedAt?: Date | null;
    },
  ): Promise<void>;
}

export interface AiModelRepository {
  findActiveOrdered(): Promise<
    Array<{
      id: string;
      providerId: string;
      providerName: ProviderName;
      modelName: string;
    }>
  >;

  findActiveTextGenerationByProviderId(providerId: string): Promise<
    Array<{
      id: string;
      providerId: string;
      providerName: ProviderName;
      modelName: string;
    }>
  >;
}

export interface ProviderCredentialRepository {
  findBestByProvider(
    providerId: string,
  ): Promise<{ id: string; apiKey: string } | null>;
}

export interface UsageLogRepository {
  create(data: {
    providerId: string;
    providerCredentialId?: string | null;
    aiModelId?: string | null;
    tokens?: number | null;
    costTotal?: number | null;
    status: TranscriptionStatus;
    errorMessage?: string | null;
  }): Promise<void>;
}
