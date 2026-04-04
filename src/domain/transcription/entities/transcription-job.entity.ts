import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';

export type ProviderAttempt = {
  providerName: string;
  modelId: string;
  credentialId?: string | null;
  status: 'SUCCESS' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
};

export class TranscriptionJobEntity {
  constructor(
    public readonly id: string,
    public readonly fileUrl: string,
    public status: TranscriptionStatus,
    public providerAttempts: ProviderAttempt[] = [],
    public resultUrl?: string | null,
    public errorMessage?: string | null,
  ) {}

  markProcessing() {
    this.status = TranscriptionStatus.PROCESSING;
  }

  markSuccess(resultUrl: string) {
    this.status = TranscriptionStatus.SUCCESS;
    this.resultUrl = resultUrl;
    this.errorMessage = null;
  }

  markFailed(message: string) {
    this.status = TranscriptionStatus.FAILED;
    this.errorMessage = message;
  }

  addAttempt(attempt: ProviderAttempt) {
    this.providerAttempts.push(attempt);
  }
}
