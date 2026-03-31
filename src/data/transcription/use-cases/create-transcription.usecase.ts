import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FileTranscriptionStatus, ProviderName } from '@prisma/client';
import type { TranscriptionJobRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import { FileService } from '@app/data/file/use-cases/file.service';
import { GetFileBufferUseCase } from '@app/data/file/use-cases/get-file-buffer.usecase';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';

const OPENAI_MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_MAX_MB_MESSAGE =
  'O arquivo do tipo áudio (.mp3) deve ter no máximo 25MB.';

@Injectable()
export class CreateTranscriptionUseCase {
  constructor(
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    private readonly fileService: FileService,
    private readonly getFileBufferUseCase: GetFileBufferUseCase,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    @InjectQueue('transcription') private readonly queue: Queue,
  ) {}

  async execute(input: {
    fileUrl: string;
    fileId: string;
    preferredModel?: string | null;
  }) {
    const active = await this.db.provider.findMany({
      where: { isActive: true },
    });
    if (active.length === 0) {
      throw new BadRequestException('Nenhum provedor de transcrição ativo.');
    }
    if (active.length > 1) {
      throw new BadRequestException(
        'Apenas um provedor de transcrição pode estar ativo.',
      );
    }

    const providerName = active[0].name;
    const sizeBytes = await this.getFileBufferUseCase.getFileSizeBytes(
      input.fileId,
    );

    if (providerName === ProviderName.OPENAI && sizeBytes > OPENAI_MAX_BYTES) {
      throw new BadRequestException(AUDIO_MAX_MB_MESSAGE);
    }

    const rawPreferred = input.preferredModel?.trim();
    if (rawPreferred && providerName !== ProviderName.TRANSCRIBE_SERVICES) {
      throw new BadRequestException(
        'O parâmetro transcribe_model só é permitido quando o provider ativo é Transcribe Services.',
      );
    }

    let preferredModel: string | null = null;
    if (providerName === ProviderName.TRANSCRIBE_SERVICES) {
      preferredModel = rawPreferred || 'small';
      if (!['tiny', 'base', 'small'].includes(preferredModel)) {
        throw new BadRequestException(
          'Modelo de transcrição inválido. Use tiny, base ou small.',
        );
      }
    }

    const job = await this.jobRepository.create({
      fileId: input.fileId,
      fileUrl: input.fileUrl,
      provider: providerName,
      preferredModel,
    });

    await this.fileService.updateTranscriptionStatus(
      input.fileId,
      FileTranscriptionStatus.PENDING,
    );

    const batchId = await this.fileService.getBatchIdForFile(input.fileId);
    if (batchId) {
      await this.fileService.markBatchFinished(batchId);
    }

    await this.queue.add('transcribe', { jobId: job.id }, { jobId: job.id });

    return {
      id: job.id,
      status: job.status,
      resultUrl: job.resultUrl ?? null,
    };
  }
}
