import { Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import {
  AIProvider,
  TranscriptionProviderError,
} from '@app/protocols/transcription/providers/ai-provider';
import { TranscriptionDomainService } from '@app/domain/transcription/services/transcription-domain.service';
import type {
  AiModelRepository,
  ProviderCredentialRepository,
  TranscriptionJobRecord,
  TranscriptionJobRepository,
  UsageLogRepository,
} from '@app/protocols/transcription/repositories/transcription-job.repository';
import { ProviderAttempt } from '@app/domain/transcription/entities/transcription-job.entity';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import { ProviderFactory } from '@app/infrastructure/transcription/providers/provider.factory';
import { GetFileBufferUseCase } from '@app/data/file/use-cases/get-file-buffer.usecase';
import { FileService } from '@app/data/file/use-cases/file.service';
import { FileTranscriptionStatus, IaCategoryKind } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { WhisperMqPublisherService } from '@app/infrastructure/transcription/messaging/whisper-mq-publisher.service';
import { buildWhisperMqSourceDownloadUrl } from '@app/infrastructure/transcription/messaging/whisper-mq-download-token';
import {
  resolveMqDownloadPublicBase,
  resolveMqDownloadSecret,
} from '@app/infrastructure/transcription/messaging/mq-download-env';

const OPENAI_MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_MAX_MB_MESSAGE =
  'O arquivo do tipo áudio (.mp3) deve ter no máximo 25MB.';

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
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    private readonly providerFactory: ProviderFactory,
    private readonly domainService: TranscriptionDomainService,
    private readonly getFileBufferUseCase: GetFileBufferUseCase,
    private readonly fileService: FileService,
    private readonly whisperMqPublisher: WhisperMqPublisherService,
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

    await this.jobRepository.updateStatus(
      job.id,
      TranscriptionStatus.PROCESSING,
    );
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
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          errorMessage:
            activeProviders.length === 0
              ? 'Nenhum provedor de transcrição ativo.'
              : 'Apenas um provedor de transcrição pode estar ativo.',
        },
      );
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
        fileSize =
          await this.getFileBufferUseCase.getFileSizeBytes(fileIdForStatus);
      } catch {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage: 'Arquivo não encontrado no storage',
          },
        );
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
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          errorMessage: AUDIO_MAX_MB_MESSAGE,
        },
      );
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      return;
    }

    if (activeName === ProviderName.TRANSCRIBE_SERVICES) {
      await this.runTranscribeServicesJob(
        job,
        fileIdForStatus,
        activeProviders[0].id,
      );
      return;
    }

    let models = await this.modelRepository.findActiveTextGenerationByProviderId(
      activeProviders[0].id,
    );

    const preferredId = job.preferredModel?.trim();
    if (preferredId) {
      const hit = models.filter((m) => m.id === preferredId);
      if (!hit.length) {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage:
              'Modelo de transcrição selecionado não está disponível ou não pertence ao provedor ativo.',
          },
        );
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.FAILED,
          );
        }
        return;
      }
      models = hit;
    }

    if (!models.length) {
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          errorMessage: `Nenhum modelo de transcrição (categoria text_generation) configurado para o provedor ${activeName}`,
        },
      );
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
      const credential = await this.credentialRepository.findBestByProvider(
        model.providerId,
      );
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
          await this.jobRepository.updateStatus(
            job.id,
            TranscriptionStatus.FAILED,
            {
              providerAttempts: attempts,
              errorMessage: 'Arquivo não encontrado no storage',
            },
          );
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

        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.SUCCESS,
          {
            providerAttempts: attempts,
            resultUrl,
            resultText: result.srtContent,
            responses: result.rawResponse ?? null,
          },
        );
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

  private safeTranscribeFileName(name: string): string {
    const n = name.trim() || 'audio.bin';
    return n.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'audio.bin';
  }

  private async runTranscribeServicesMqJob(
    job: TranscriptionJobRecord,
    fileIdForStatus: string | null,
    providerId: string,
    modelName: string,
    fileName: string,
    attempts: ProviderAttempt[],
    credentialId: string | null,
    delivery:
      | { mode: 'signed_url' }
      | { mode: 'shared_path'; fileBuffer: Buffer },
  ): Promise<void> {
    const startedAt = new Date().toISOString();
    let fullPath: string | undefined;
    let fileDownloadUrl: string | undefined;

    if (delivery.mode === 'signed_url') {
      const publicBase = resolveMqDownloadPublicBase(this.config);
      const secret = resolveMqDownloadSecret(this.config);
      const ttl = this.config.WHISPER_MQ_DOWNLOAD_TTL_SEC;
      fileDownloadUrl = buildWhisperMqSourceDownloadUrl(
        publicBase,
        job.id,
        secret,
        ttl,
      );
    } else {
      const sharedRoot = this.config.TRANSCRIPTION_SHARED_STORAGE_PATH.trim();
      const safeName = this.safeTranscribeFileName(fileName);
      const diskName = `${job.id}__${safeName}`;
      fullPath = path.join(sharedRoot, diskName);

      try {
        await fs.mkdir(sharedRoot, { recursive: true });
        await fs.writeFile(fullPath, delivery.fileBuffer);
      } catch (err) {
        const error = err as Error;
        attempts.push({
          providerName: ProviderName.TRANSCRIBE_SERVICES,
          modelId: 'transcribe-services',
          credentialId,
          status: 'FAILED',
          errorCode: 'UNKNOWN',
          errorMessage: error.message,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            providerAttempts: attempts,
            errorMessage: `Falha ao gravar arquivo no diretório compartilhado: ${error.message}`,
            finishedAt: new Date(),
          },
        );
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.FAILED,
          );
        }
        await this.usageLogRepository.create({
          providerId,
          providerCredentialId: credentialId,
          aiModelId: null,
          tokens: null,
          costTotal: null,
          status: TranscriptionStatus.FAILED,
          errorMessage: error.message,
        });
        return;
      }
    }

    await this.jobRepository.updateStatus(
      job.id,
      TranscriptionStatus.PROCESSING,
      {
        providerAttempts: attempts,
        provider: ProviderName.TRANSCRIBE_SERVICES,
        externalJobId: job.id,
        responses: {
          transport: 'rabbitmq',
          language: '',
          progress: 0,
          model: modelName,
          status: 'queued',
          job_id: job.id,
          text_content: '',
          segments: [],
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

    const published = await this.whisperMqPublisher.publishJob({
      job_id: job.id,
      model: modelName,
      original_filename: fileName,
      ...(fileDownloadUrl
        ? { file_url: fileDownloadUrl }
        : { file_path: fullPath! }),
    });

    if (!published) {
      attempts.push({
        providerName: ProviderName.TRANSCRIBE_SERVICES,
        modelId: 'transcribe-services',
        credentialId,
        status: 'FAILED',
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: 'RabbitMQ indisponível ao publicar job Whisper',
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          providerAttempts: attempts,
          errorMessage: 'RabbitMQ indisponível ao publicar job Whisper',
          finishedAt: new Date(),
        },
      );
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      await this.usageLogRepository.create({
        providerId,
        providerCredentialId: credentialId,
        aiModelId: null,
        tokens: null,
        costTotal: null,
        status: TranscriptionStatus.FAILED,
        errorMessage: 'RabbitMQ indisponível ao publicar job Whisper',
      });
      if (fullPath) {
        try {
          await fs.unlink(fullPath);
        } catch {
          void 0;
        }
      }
    }
  }

  private async runTranscribeServicesJob(
    job: TranscriptionJobRecord,
    fileIdForStatus: string | null,
    providerId: string,
  ) {
    const attempts = job.providerAttempts ?? [];
    const credential =
      await this.credentialRepository.findBestByProvider(providerId);
    const apiKey = credential?.apiKey ?? '';
    const rawPref = job.preferredModel?.trim() ?? '';
    const dbModel = rawPref
      ? await this.db.aiModel.findFirst({
          where: {
            id: rawPref,
            providerId,
            isActive: true,
            category: { tipo: IaCategoryKind.TEXT_GENERATION },
          },
        })
      : null;
    const modelName = dbModel?.modelName?.trim()
      ? dbModel.modelName.trim()
      : this.normalizeTranscribeModel(rawPref);

    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    if (fileIdForStatus) {
      try {
        const resolved =
          await this.getFileBufferUseCase.execute(fileIdForStatus);
        fileBuffer = resolved.buffer;
        fileName = resolved.fileName;
      } catch {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage: 'Arquivo não encontrado no storage',
          },
        );
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.FAILED,
          );
        }
        return;
      }
    }

    const mqUrl = this.config.RABBITMQ_URL?.trim();
    if (mqUrl) {
      const publicBase = resolveMqDownloadPublicBase(this.config);
      const dlSecret = resolveMqDownloadSecret(this.config);
      const sharedRoot = this.config.TRANSCRIPTION_SHARED_STORAGE_PATH?.trim();
      const useSignedUrl = Boolean(publicBase && dlSecret);

      if (!useSignedUrl && !sharedRoot) {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage:
              'Com RABBITMQ_URL: configure PUBLIC_APP_URL + WHISPER_MQ_DOWNLOAD_SECRET (URL assinada) ou TRANSCRIPTION_SHARED_STORAGE_PATH (volume compartilhado)',
          },
        );
        if (fileIdForStatus) {
          await this.fileService.updateTranscriptionStatus(
            fileIdForStatus,
            FileTranscriptionStatus.FAILED,
          );
        }
        return;
      }

      if (!fileIdForStatus) {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage: 'Arquivo ausente para envio ao Whisper via fila',
          },
        );
        return;
      }

      const fileRow = await this.db.file.findUnique({
        where: { id: fileIdForStatus },
        select: { originalName: true },
      });
      if (!fileRow) {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage: 'Arquivo não encontrado no banco',
          },
        );
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
        return;
      }

      const nameForMq = fileRow.originalName || fileName || 'audio.bin';

      if (useSignedUrl) {
        await this.runTranscribeServicesMqJob(
          job,
          fileIdForStatus,
          providerId,
          modelName,
          nameForMq,
          attempts,
          credential?.id ?? null,
          { mode: 'signed_url' },
        );
        return;
      }

      if (!fileBuffer) {
        await this.jobRepository.updateStatus(
          job.id,
          TranscriptionStatus.FAILED,
          {
            errorMessage: 'Arquivo ausente para envio ao Whisper via fila',
          },
        );
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
        return;
      }

      await this.runTranscribeServicesMqJob(
        job,
        fileIdForStatus,
        providerId,
        modelName,
        nameForMq,
        attempts,
        credential?.id ?? null,
        { mode: 'shared_path', fileBuffer },
      );
      return;
    }

    let provider: AIProvider;
    try {
      provider = this.providerFactory.create(
        ProviderName.TRANSCRIBE_SERVICES,
        apiKey,
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Falha ao inicializar Transcribe Services';
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          errorMessage: msg,
        },
      );
      if (fileIdForStatus) {
        await this.fileService.updateTranscriptionStatus(
          fileIdForStatus,
          FileTranscriptionStatus.FAILED,
        );
      }
      return;
    }

    const startedAt = new Date().toISOString();
    try {
      if (!provider.startExternalJob) {
        throw new Error(
          'Provider externo não suporta criação assíncrona de job',
        );
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
          provider: ProviderName.TRANSCRIBE_SERVICES,
          externalJobId: started.jobId,
          responses: started.rawResponse ?? {
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
        providerName: ProviderName.TRANSCRIBE_SERVICES,
        modelId: 'transcribe-services',
        credentialId: credential?.id ?? null,
        status: 'FAILED',
        errorCode,
        errorMessage: error.message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          providerAttempts: attempts,
          errorMessage: error.message,
          finishedAt: new Date(),
        },
      );
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
