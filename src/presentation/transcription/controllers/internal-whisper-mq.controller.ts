import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common/pipes';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { Public } from '@app/presentation/auth/decorators/public.decorator';
import { FileService } from '@app/data/file/use-cases/file.service';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import type { TranscriptionJobRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';
import { verifyWhisperMqJobSource } from '@app/infrastructure/transcription/messaging/whisper-mq-download-token';
import { resolveMqDownloadSecret } from '@app/infrastructure/transcription/messaging/mq-download-env';

@Controller('internal/whisper-mq')
@Public()
export class InternalWhisperMqController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    private readonly fileService: FileService,
  ) {}

  private extractFileIdFromUrl(fileUrl: string): string | null {
    const match = fileUrl.match(/\/files\/([^/]+)\/download/);
    return match?.[1] ?? null;
  }

  @Get('transcription-jobs/:jobId/source')
  async downloadJobSource(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
  ): Promise<StreamableFile> {
    const secret = resolveMqDownloadSecret(this.config);
    if (!secret) {
      throw new ServiceUnavailableException(
        'WHISPER_MQ_DOWNLOAD_SECRET não configurado',
      );
    }
    if (!verifyWhisperMqJobSource(secret, jobId, exp ?? '', sig ?? '')) {
      throw new ForbiddenException('Assinatura inválida ou expirada');
    }

    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new NotFoundException('Job não encontrado');
    }

    const fileId = job.fileId ?? this.extractFileIdFromUrl(job.fileUrl);
    if (!fileId) {
      throw new NotFoundException('Arquivo do job não encontrado');
    }

    const { stream, originalName } =
      await this.fileService.getInternalStorageReadStream(fileId);

    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${originalName}"`,
    });
  }
}
