import { Inject, Injectable } from '@nestjs/common';
import { FileTranscriptionStatus } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { FileService } from '@app/data/file/use-cases/file.service';
import { ProviderFactory } from '@app/infrastructure/transcription/providers/provider.factory';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import type {
  ProviderCredentialRepository,
  TranscriptionJobRepository,
  UsageLogRepository,
} from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';
import { TranscriptionProviderError } from '@app/protocols/transcription/providers/ai-provider';

@Injectable()
export class SyncTranscriptionStatusUseCase {
  constructor(
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    @Inject(TRANSCRIPTION_TOKENS.CredentialRepository)
    private readonly credentialRepository: ProviderCredentialRepository,
    @Inject(TRANSCRIPTION_TOKENS.UsageLogRepository)
    private readonly usageLogRepository: UsageLogRepository,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly providerFactory: ProviderFactory,
    private readonly fileService: FileService,
  ) {}

  private resolveExternalJobId(job: {
    externalJobId?: string | null;
    responses?: unknown | null;
  }): string | null {
    if (job.externalJobId) return job.externalJobId;
    const payload = job.responses;
    if (!payload || typeof payload !== 'object') return null;
    const obj = payload as Record<string, unknown>;
    const raw =
      obj.job_id ??
      obj.jobId ??
      obj.id;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }

  async execute(input: { transcriptionJobId: string }) {
    const job = await this.jobRepository.findById(input.transcriptionJobId);
    if (!job) return;
    if (job.provider !== 'TRANSCRIBE_SERVICES') return;
    const externalJobId = this.resolveExternalJobId(job);
    if (!externalJobId) return;
    if (
      job.status !== TranscriptionStatus.PENDING &&
      job.status !== TranscriptionStatus.PROCESSING
    ) {
      return;
    }

    await this.jobRepository.updateStatus(job.id, job.status, {
      lastStatusCheckAt: new Date(),
      attemptsIncrement: true,
    });

    const provider = await this.db.provider.findFirst({
      where: { name: 'TRANSCRIBE_SERVICES' },
      select: { id: true },
    });
    if (!provider) return;

    const credential = await this.credentialRepository.findBestByProvider(provider.id);
    const client = this.providerFactory.create(
      'TRANSCRIBE_SERVICES',
      credential?.apiKey ?? '',
    );
    if (!client.fetchExternalJobStatus) return;

    try {
      const status = await client.fetchExternalJobStatus(externalJobId);
      if (status.status === 'queued' || status.status === 'processing') {
        await this.jobRepository.updateStatus(
          job.id,
          status.status === 'queued'
            ? TranscriptionStatus.PENDING
            : TranscriptionStatus.PROCESSING,
          { responses: status.rawResponse ?? null, lastStatusCheckAt: new Date() },
        );
        return;
      }

      if (status.status === 'completed') {
        await this.jobRepository.updateStatus(job.id, TranscriptionStatus.SUCCESS, {
          responses: status.rawResponse ?? null,
          resultText: status.srtContent ?? null,
          resultUrl: `/transcriptions/${job.id}/result`,
          finishedAt: new Date(),
          lastStatusCheckAt: new Date(),
        });
        if (job.fileId) {
          await this.fileService.updateTranscriptionStatus(
            job.fileId,
            FileTranscriptionStatus.SUCCESS,
          );
        }
        await this.usageLogRepository.create({
          providerId: provider.id,
          providerCredentialId: credential?.id ?? null,
          aiModelId: null,
          status: TranscriptionStatus.SUCCESS,
        });
        return;
      }

      await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
        responses: status.rawResponse ?? null,
        errorMessage: status.errorMessage ?? 'Falha no provider externo',
        finishedAt: new Date(),
        lastStatusCheckAt: new Date(),
      });
      if (job.fileId) {
        await this.fileService.updateTranscriptionStatus(
          job.fileId,
          FileTranscriptionStatus.FAILED,
        );
      }
    } catch (error) {
      const err = error as Error;
      const msg =
        error instanceof TranscriptionProviderError ? error.message : err.message;
      await this.jobRepository.updateStatus(job.id, job.status, {
        errorMessage: msg,
        lastStatusCheckAt: new Date(),
      });
    }
  }
}

