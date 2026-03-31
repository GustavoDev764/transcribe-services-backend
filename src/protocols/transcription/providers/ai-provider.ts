import { TranscriptionErrorCode } from '@app/domain/transcription/services/transcription-domain.service';

export type TranscriptionInput = {
  fileUrl: string;
  modelName: string;
  language?: string;
  fileBuffer?: Buffer;
  fileName?: string;
};

export type TranscriptionOutput = {
  text: string;
  srtContent: string;
  tokensUsed?: number;
  rawResponse?: unknown;
};

export type ExternalTranscriptionStartOutput = {
  jobId: string;
  status: 'queued' | 'processing';
  rawResponse?: unknown;
};

export type ExternalTranscriptionStatusOutput = {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  text?: string;
  srtContent?: string;
  language?: string;
  rawResponse?: unknown;
  errorMessage?: string | null;
};

export class TranscriptionProviderError extends Error {
  constructor(
    message: string,
    public readonly code: TranscriptionErrorCode,
  ) {
    super(message);
  }
}

export interface AIProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionOutput>;
  startExternalJob?(
    input: TranscriptionInput,
  ): Promise<ExternalTranscriptionStartOutput>;
  fetchExternalJobStatus?(
    externalJobId: string,
  ): Promise<ExternalTranscriptionStatusOutput>;
}
