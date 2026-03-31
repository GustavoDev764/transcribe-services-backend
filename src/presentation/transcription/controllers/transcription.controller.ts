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

@Controller('transcriptions')
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(
    private readonly createUseCase: CreateTranscriptionUseCase,
    private readonly fileService: FileService,
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
  ) {}

  @Get('integration')
  async integration() {
    const active = await this.db.provider.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const single = active.length === 1 ? active[0] : null;
    return {
      active_provider: single?.name ?? null,
      transcribe_services_enabled: single?.name === 'TRANSCRIBE_SERVICES',
      openai_enabled: single?.name === 'OPENAI',
    };
  }

  @Post()
  async create(@Body() dto: CreateTranscriptionDto, @Req() req: Request) {
    const fileUrl = `${req.protocol}://${req.get('host')}${this.fileService.buildDownloadUrl(dto.file_id)}`;
    return this.createUseCase.execute({
      fileUrl,
      fileId: dto.file_id,
      preferredModel: dto.transcribe_model ?? null,
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
    if (!job || !job.resultText) {
      throw new NotFoundException('Resultado não disponível');
    }
    const stream = Readable.from([job.resultText]);
    return new StreamableFile(stream, {
      type: 'text/plain',
      disposition: `attachment; filename="transcription-${id}.srt"`,
    });
  }
}
