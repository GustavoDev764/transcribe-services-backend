import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { CreateTranscriptionDto } from '@app/presentation/transcription/requests/create-transcription.dto';
import { CreateTranscriptionUseCase } from '@app/data/transcription/use-cases/create-transcription.usecase';
import type { TranscriptionJobRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import { Readable } from 'stream';
import type { Request } from 'express';
import { FileService } from '@app/data/file/use-cases/file.service';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import { SystemConfigService } from '@app/data/system-config/use-cases/system-config.service';
import { SYSTEM_CONFIG_KEYS } from '@app/data/system-config/system-config-keys';
import { mergeTranscribeModelUiFromJson } from '@app/data/transcription/transcribe-model-ui';
import { IaCategoryKind } from '@prisma/client';
import { srtFromStoredResponses } from '@app/domain/transcription/services/canonical-transcription-responses';

@Controller('transcriptions')
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(
    private readonly createUseCase: CreateTranscriptionUseCase,
    private readonly fileService: FileService,
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly systemConfig: SystemConfigService,
  ) {}

  @Get('integration')
  async integration() {
    const active = await this.db.provider.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const single = active.length === 1 ? active[0] : null;
    const name = single?.name ?? null;
    const rawUi = await this.systemConfig.getConfig(
      SYSTEM_CONFIG_KEYS.TRANSCRIBE_MODEL_UI_CONFIG,
    );
    const transcribe_model_ui = mergeTranscribeModelUiFromJson(rawUi);

    let transcription_models: Array<{
      id: string;
      name: string;
      model_name: string;
      subtitle: string | null;
      text_tooltip: string | null;
      url_icone: string | null;
      icon_file_name: string | null;
    }> = [];
    if (single) {
      const rows = await this.db.aiModel.findMany({
        where: {
          providerId: single.id,
          isActive: true,
          category: { tipo: IaCategoryKind.TEXT_GENERATION },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          modelName: true,
          subtitle: true,
          textTooltip: true,
          urlIcone: true,
          iconFileName: true,
        },
      });
      transcription_models = rows.map((m) => ({
        id: m.id,
        name: m.name,
        model_name: m.modelName,
        subtitle: m.subtitle,
        text_tooltip: m.textTooltip,
        url_icone: m.urlIcone,
        icon_file_name: m.iconFileName,
      }));
    }

    const diarizeOpenAiEnabled =
      name === ProviderName.OPENAI && single
        ? (await this.db.aiModel.count({
            where: {
              providerId: single.id,
              isActive: true,
              category: { tipo: IaCategoryKind.AUDIO_AND_SPEECH },
            },
          })) > 0
        : false;

    return {
      active_provider: name,
      transcribe_services_enabled: name === ProviderName.TRANSCRIBE_SERVICES,
      openai_enabled: name === ProviderName.OPENAI,
      elevenlabs_enabled: name === ProviderName.ELEVENLABS,
      diarize_openai_enabled: diarizeOpenAiEnabled,
      diarize_elevenlabs_enabled: name === ProviderName.ELEVENLABS,
      transcribe_model_ui,
      transcription_models,
    };
  }

  @Post()
  async create(@Body() dto: CreateTranscriptionDto, @Req() req: Request) {
    const fileUrl = `${req.protocol}://${req.get('host')}${this.fileService.buildDownloadUrl(dto.file_id)}`;
    return this.createUseCase.execute({
      fileUrl,
      fileId: dto.file_id,
      preferredAiModelId: dto.preferred_ai_model_id ?? null,
      transcribeModel: dto.transcribe_model ?? null,
      recognizeSpeakers: dto.recognize_speakers === true,
      diarizeSpeakerCount: dto.diarize_speaker_count,
    });
  }

  @Get(':id')
  async getStatus(@Param('id') id: string) {
    const job = await this.jobRepository.findById(id);
    if (!job) throw new NotFoundException('Job não encontrado');
    return {
      id: job.id,
      status: job.status,
      result_url: job.resultUrl ?? null,
      error_message: job.errorMessage ?? null,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    };
  }

  @Get(':id/result')
  async downloadResult(@Param('id') id: string): Promise<StreamableFile> {
    const job = await this.jobRepository.findById(id);
    const srt = srtFromStoredResponses(job?.responses);
    if (!job || !srt) {
      throw new NotFoundException('Resultado não disponível');
    }
    const stream = Readable.from([srt]);
    return new StreamableFile(stream, {
      type: 'text/plain',
      disposition: `attachment; filename="transcription-${id}.srt"`,
    });
  }
}
