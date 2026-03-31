import { Inject, Injectable } from '@nestjs/common';
import { ProviderName } from '@prisma/client';
import { AIProvider, TranscriptionProviderError } from '@app/protocols/transcription/providers/ai-provider';
import { TranscriptionDomainService } from '@app/domain/transcription/services/transcription-domain.service';
import type {
  AiModelRepository,
  ProviderCredentialRepository,
  TranscriptionJobRecord,
  TranscriptionJobRepository,
  UsageLogRepository,
} from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import { ProviderFactory } from '@app/infrastructure/transcription/providers/provider.factory';
import { GetFileBufferUseCase } from '@app/data/file/use-cases/get-file-buffer.usecase';
import { FileService } from '@app/data/file/use-cases/file.service';
import { FileTranscriptionStatus } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';

const OPENAI_MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_MAX_MB_MESSAGE = 'O arquivo do tipo áudio (.mp3) deve ter no máximo 25MB.';

@Injectable()
export class ProcessTranscriptionUseCase {
  constructor(
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    @Inject(TRANSCRIPTION_TOKENS.ModelRepository)
    private readonly modelRepository: AiModelRepository,
    @Inject(TRANSCRIPTION_TOKENS.CredentialRepository)
    private readonly credentialRepository: ProviderCredentialRepository,
    @Inject(TRANSCRIPTION_TOKENS.UsageLogRepository)
    private readonly usageLogRepository: UsageLogRepository,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly providerFactory: ProviderFactory,
    private readonly domainService: TranscriptionDomainService,
    private readonly getFileBufferUseCase: GetFileBufferUseCase,
    private readonly fileService: FileService,
  ) {}

  private extractFileId(fileUrl: string): string | null {
    const match = fileUrl.match(/\/files\/([^/]+)\/download/);
    return match?.[1] ?? null;
  }

  private normalizeTranscribeModel(raw: string | null | undefined): string {
    const m = (raw ?? 'small').trim().toLowerCase();
    if (['tiny', 'base', 'small'].includes(m)) return m;
    return 'small';
  }

  async execute(input: { jobId: string }) {
    const job = await this.jobRepository.findById(input.jobId);
    if (!job) throw new Error('Job não encontrado');

    await this.jobRepository.updateStatus(job.id, TranscriptionStatus.PROCESSING);
    const fileIdForStatus = this.extractFileId(job.fileUrl);
    if (fileIdForStatus) {
      await this.fileService.updateTranscriptionStatus(
        fileIdForStatus,
        FileTranscriptionStatus.PROCESSING,
      );
    }

    const activeProviders = await this.db.provider.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (activeProviders.length !== 1) {
      await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
        errorMessage:
          activeProviders.length === 0
            ? 'Nenhum provedor de transcrição ativo.'
            : 'Apenas um provedor de transcrição pode estar ativo.',
      });
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      return;
    }

    const activeName = activeProviders[0].name as ProviderName;
    let fileSize = 0;
    if (fileIdForStatus) {
      try {
        fileSize = await this.getFileBufferUseCase.getFileSizeBytes(fileIdForStatus);
      } catch {
        await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
          errorMessage: 'Arquivo não encontrado no storage',
        });
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.FAILED,
          );
        }
        return;
      }
    }

    if (activeName === ProviderName.OPENAI && fileSize > OPENAI_MAX_BYTES) {
      await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
        errorMessage: AUDIO_MAX_MB_MESSAGE,
      });
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      return;
    }

    if (activeName === ProviderName.TRANSCRIBE_SERVICES) {
      await this.runTranscribeServicesJob(job, fileIdForStatus, activeProviders[0].id);
      return;
    }

    const models = (await this.modelRepository.findActiveOrdered()).filter(
      (m) => m.providerName === activeName,
    );

    if (!models.length) {
      await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
        errorMessage: `Nenhum modelo configurado para provider ${activeName}`,
      });
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      return;
    }

    const attempts = job.providerAttempts ?? [];
    let lastError: Error | null = null;

    for (const model of models) {
      const credential = await this.credentialRepository.findBestByProvider(model.providerId);
      if (!credential) {
        lastError = new Error('Credenciais não configuradas');
        attempts.push({
          providerName: model.providerName,
          modelId: model.id,
          credentialId: null,
          status: 'FAILED',
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Credenciais não configuradas',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
        continue;
      }

      const provider: AIProvider = this.providerFactory.create(
        model.providerName,
        credential.apiKey,
      );
      const fileId = fileIdForStatus;
      let fileBuffer: Buffer | undefined;
      let fileName: string | undefined;
      if (fileId) {
        try {
          const resolved = await this.getFileBufferUseCase.execute(fileId);
          fileBuffer = resolved.buffer;
          fileName = resolved.fileName;
        } catch {
          await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
            providerAttempts: attempts,
            errorMessage: 'Arquivo não encontrado no storage',
          });
          if (fileIdForStatus) {
            await this.fileService.updateTranscriptionStatus(
              fileIdForStatus,
              FileTranscriptionStatus.FAILED,
            );
          }
          return;
        }
      }
      const startedAt = new Date().toISOString();
      try {
        const result = await provider.transcribe({
          fileUrl: job.fileUrl,
          modelName: model.modelName,
          fileBuffer,
          fileName,
        });

        const resultUrl = `/transcriptions/${job.id}/result`;
        attempts.push({
          providerName: model.providerName,
          modelId: model.id,
          credentialId: credential.id,
          status: 'SUCCESS',
          startedAt,
          finishedAt: new Date().toISOString(),
        });

        await this.jobRepository.updateStatus(job.id, TranscriptionStatus.SUCCESS, {
          providerAttempts: attempts,
          resultUrl,
          resultText: result.srtContent,
          responses: result.rawResponse ?? null,
        });
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.SUCCESS,
          );
        }

        await this.usageLogRepository.create({
          providerId: model.providerId,
          providerCredentialId: credential.id,
          aiModelId: model.id,
          tokens: result.tokensUsed ?? null,
          costTotal: null,
          status: TranscriptionStatus.SUCCESS,
        });
        return;
      } catch (err) {
        const error = err as Error;
        lastError = error;
        const errorCode =
          err instanceof TranscriptionProviderError ? err.code : 'UNKNOWN';
        attempts.push({
          providerName: model.providerName,
          modelId: model.id,
          credentialId: credential.id,
          status: 'FAILED',
          errorCode,
          errorMessage: error.message,
          startedAt,
          finishedAt: new Date().toISOString(),
        });

        await this.usageLogRepository.create({
          providerId: model.providerId,
          providerCredentialId: credential.id,
          aiModelId: model.id,
          tokens: null,
          costTotal: null,
          status: TranscriptionStatus.FAILED,
          errorMessage: error.message,
        });

        if (!this.domainService.shouldFallback(errorCode)) {
          break;
        }
      }
    }

    await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
      providerAttempts: attempts,
      errorMessage: lastError?.message || 'Falha na transcrição',
    });
    if (fileIdForStatus) {
      await this.fileService.updateTranscriptionStatus(
        fileIdForStatus,
        FileTranscriptionStatus.FAILED,
      );
    }
  }

  private async runTranscribeServicesJob(
    job: TranscriptionJobRecord,
    fileIdForStatus: string | null,
    providerId: string,
  ) {
    const attempts = job.providerAttempts ?? [];
    const credential = await this.credentialRepository.findBestByProvider(providerId);
    const apiKey = credential?.apiKey ?? '';

    let provider: AIProvider;
    try {
      provider = this.providerFactory.create('TRANSCRIBE_SERVICES', apiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao inicializar Transcribe Services';
      await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
        errorMessage: msg,
      });
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      return;
    }

    const modelName = this.normalizeTranscribeModel(job.preferredModel);
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    if (fileIdForStatus) {
      try {
        const resolved = await this.getFileBufferUseCase.execute(fileIdForStatus);
        fileBuffer = resolved.buffer;
        fileName = resolved.fileName;
      } catch {
        await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
          errorMessage: 'Arquivo não encontrado no storage',
        });
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.FAILED,
          );
        }
        return;
      }
    }

    const startedAt = new Date().toISOString();
    try {
      if (!provider.startExternalJob) {
        throw new Error('Provider externo não suporta criação assíncrona de job');
      }
      const started = await provider.startExternalJob({
        fileUrl: job.fileUrl,
        modelName,
        fileBuffer,
        fileName,
      });

      await this.jobRepository.updateStatus(
        job.id,
        started.status === 'queued'
          ? TranscriptionStatus.PENDING
          : TranscriptionStatus.PROCESSING,
        {
          providerAttempts: attempts,
          provider: 'TRANSCRIBE_SERVICES',
          externalJobId: started.jobId,
          responses:
            started.rawResponse ??
            {
              job_id: started.jobId,
              status: started.status,
            },
          lastStatusCheckAt: new Date(),
        },
      );
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.PROCESSING,
        );
      }
    } catch (err) {
      const error = err as Error;
      const errorCode =
        err instanceof TranscriptionProviderError ? err.code : 'UNKNOWN';
      attempts.push({
        providerName: 'TRANSCRIBE_SERVICES',
        modelId: 'transcribe-services',
        credentialId: credential?.id ?? null,
        status: 'FAILED',
        errorCode,
        errorMessage: error.message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      await this.jobRepository.updateStatus(job.id, TranscriptionStatus.FAILED, {
        providerAttempts: attempts,
        errorMessage: error.message,
        finishedAt: new Date(),
      });
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      await this.usageLogRepository.create({
        providerId,
        providerCredentialId: credential?.id ?? null,
        aiModelId: null,
        tokens: null,
        costTotal: null,
        status: TranscriptionStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }
}
