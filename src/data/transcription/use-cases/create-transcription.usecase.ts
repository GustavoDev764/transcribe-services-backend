import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FileTranscriptionStatus, IaCategoryKind } from '@prisma/client';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
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
    preferredAiModelId?: string | null;
    transcribeModel?: 'tiny' | 'base' | 'small' | null;
    recognizeSpeakers?: boolean;
    diarizeSpeakerCount?: number;
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

    const providerName = active[0].name as ProviderName;
    const activeProviderId = active[0].id;
    const sizeBytes = await this.getFileBufferUseCase.getFileSizeBytes(
      input.fileId,
    );

    if (providerName === ProviderName.OPENAI && sizeBytes > OPENAI_MAX_BYTES) {
      throw new BadRequestException(AUDIO_MAX_MB_MESSAGE);
    }

    const rawWhisper = input.transcribeModel?.trim();
    if (
      rawWhisper &&
      providerName !== ProviderName.TRANSCRIBE_SERVICES &&
      !input.preferredAiModelId?.trim()
    ) {
      throw new BadRequestException(
        'O parâmetro transcribe_model só é permitido quando o provider ativo é Transcribe Services.',
      );
    }

    let diarizeEnabled = false;
    let diarizeSpeakerCount: number | null = null;
    if (input.recognizeSpeakers === true) {
      if (providerName === ProviderName.OPENAI) {
        const audioModelCount = await this.db.aiModel.count({
          where: {
            providerId: activeProviderId,
            isActive: true,
            category: { tipo: IaCategoryKind.AUDIO_AND_SPEECH },
          },
        });
        if (audioModelCount === 0) {
          throw new BadRequestException(
            'Cadastre ao menos um modelo ativo na categoria áudio e fala (ex.: gpt-4o-transcribe-diarize) para reconhecer locutores.',
          );
        }
        diarizeEnabled = true;
        const c = input.diarizeSpeakerCount;
        diarizeSpeakerCount =
          typeof c === 'number' && Number.isInteger(c) && c >= 2 && c <= 8
            ? c
            : null;
      } else if (providerName === ProviderName.ELEVENLABS) {
        diarizeEnabled = true;
        const c = input.diarizeSpeakerCount;
        diarizeSpeakerCount =
          typeof c === 'number' && Number.isInteger(c) && c >= 2 && c <= 32
            ? c
            : null;
      } else {
        throw new BadRequestException(
          'Reconhecimento de locutores só está disponível com OpenAI ou ElevenLabs.',
        );
      }
    }

    const rawAiModelId = input.preferredAiModelId?.trim();
    let preferredModel: string | null = null;

    if (rawAiModelId) {
      const row = await this.db.aiModel.findFirst({
        where: {
          id: rawAiModelId,
          isActive: true,
          providerId: activeProviderId,
          category: { tipo: IaCategoryKind.TEXT_GENERATION },
        },
      });
      if (!row) {
        throw new BadRequestException(
          'Modelo de transcrição inválido ou indisponível para o provedor ativo.',
        );
      }
      preferredModel = rawAiModelId;
    } else if (providerName === ProviderName.TRANSCRIBE_SERVICES) {
      const w = rawWhisper ?? '';
      preferredModel = w && ['tiny', 'base', 'small'].includes(w) ? w : 'small';
    }

    const job = await this.jobRepository.create({
      fileId: input.fileId,
      fileUrl: input.fileUrl,
      provider: providerName,
      preferredModel,
      diarizeEnabled,
      diarizeSpeakerCount,
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
