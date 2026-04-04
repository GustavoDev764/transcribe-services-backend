import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FileTranscriptionStatus } from '@prisma/client';
import * as amqp from 'amqplib';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import type {
  ProviderCredentialRepository,
  TranscriptionJobRepository,
  UsageLogRepository,
} from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';
import { FileService } from '@app/data/file/use-cases/file.service';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import {
  buildCanonicalTranscriptionResponses,
  canonicalSegmentsToSrt,
} from '@app/domain/transcription/services/canonical-transcription-responses';

type WhisperStatusPayload = {
  job_id: string;
  status: 'await' | 'processing' | 'concluded';
  percent: number;
  error_message?: string | null;
  text_content?: string;
  segments?: unknown[];
  language?: string | null;
};

@Injectable()
export class WhisperMqConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhisperMqConsumerService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    @Inject(TRANSCRIPTION_TOKENS.JobRepository)
    private readonly jobRepository: TranscriptionJobRepository,
    @Inject(TRANSCRIPTION_TOKENS.CredentialRepository)
    private readonly credentialRepository: ProviderCredentialRepository,
    @Inject(TRANSCRIPTION_TOKENS.UsageLogRepository)
    private readonly usageLogRepository: UsageLogRepository,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly fileService: FileService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.RABBITMQ_URL?.trim();
    if (!url) {
      this.logger.log(
        'RABBITMQ_URL vazio — consumer de status Whisper desativado',
      );
      return;
    }
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      const q = this.config.WHISPER_STATUS_QUEUE;
      await this.channel.assertQueue(q, { durable: true });
      await this.channel.consume(
        q,
        (msg) => {
          if (!msg || !this.channel) return;
          void this.dispatch(msg);
        },
        { noAck: false },
      );
      this.logger.log(`Consumindo fila de status Whisper: ${q}`);
    } catch (e) {
      const err = e as Error;
      this.logger.error(
        `Não foi possível iniciar consumer Whisper MQ: ${err.message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
    } catch {
      void 0;
    }
    try {
      await this.connection?.close();
    } catch {
      void 0;
    }
    this.channel = null;
    this.connection = null;
  }

  private async dispatch(msg: amqp.ConsumeMessage): Promise<void> {
    if (!this.channel) return;
    try {
      const raw = JSON.parse(msg.content.toString()) as WhisperStatusPayload;
      await this.applyStatus(raw);
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`Mensagem de status inválida: ${err.message}`);
    } finally {
      try {
        this.channel.ack(msg);
      } catch {
        void 0;
      }
    }
  }

  private whisperResponsesPayload(
    block: Record<string, unknown>,
  ): Record<string, unknown> {
    return { ...block };
  }

  private readPreviousWhisperState(
    responses: unknown,
  ): Record<string, unknown> | null {
    if (
      !responses ||
      typeof responses !== 'object' ||
      Array.isArray(responses)
    ) {
      return null;
    }
    const r = responses as Record<string, unknown>;
    if (r.transport === 'rabbitmq') return r;
    const legacy = r.whisperMq;
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      return legacy as Record<string, unknown>;
    }
    return null;
  }

  private normalizeTranscribeModel(raw: string | null | undefined): string {
    const m = (raw ?? 'small').trim().toLowerCase();
    if (['tiny', 'base', 'small'].includes(m)) return m;
    return 'small';
  }

  private whisperMqApiStatus(
    wire: WhisperStatusPayload['status'],
    concludedFailed: boolean,
  ): string {
    if (wire === 'await') return 'queued';
    if (wire === 'processing') return 'processing';
    if (wire === 'concluded') return concludedFailed ? 'failed' : 'completed';
    return 'processing';
  }

  private buildWhisperMqBlock(
    job: { id: string; preferredModel?: string | null; responses?: unknown },
    payload: WhisperStatusPayload,
    opts: {
      text_content: string;
      segments: unknown[];
      error?: string;
    },
  ): Record<string, unknown> {
    const err = opts.error?.trim();
    const concludedFailed = payload.status === 'concluded' && Boolean(err);
    const langFromPayload =
      payload.language != null && String(payload.language).trim() !== ''
        ? String(payload.language).trim()
        : '';
    const prevLang = this.readPreviousWhisperState(job.responses);
    const prevLanguageStr =
      typeof prevLang?.language === 'string' ? prevLang.language.trim() : '';
    const language = langFromPayload || prevLanguageStr;

    const block: Record<string, unknown> = {
      transport: 'rabbitmq',
      language,
      progress: Math.min(100, Math.max(0, Math.round(payload.percent))),
      model: this.normalizeTranscribeModel(job.preferredModel),
      status: this.whisperMqApiStatus(payload.status, concludedFailed),
      job_id: job.id,
      text_content: opts.text_content,
      segments: opts.segments,
    };
    if (err) block.error = err;
    return block;
  }

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private segmentsToSrt(
    segments: Array<{ start: number; end: number; text: string }>,
  ): string {
    return segments
      .map((seg, i) => {
        const start = this.formatSrtTime(seg.start);
        const end = this.formatSrtTime(seg.end);
        return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
      })
      .join('\n');
  }

  private singleSegmentSrt(text: string): string {
    if (!text) return '';
    return `1\n00:00:00,000 --> 00:00:10,000\n${text.trim()}\n`;
  }

  private async applyStatus(payload: WhisperStatusPayload): Promise<void> {
    const jobId = payload.job_id?.trim();
    if (!jobId) return;

    const job = await this.jobRepository.findById(jobId);
    if (!job || job.provider !== ProviderName.TRANSCRIBE_SERVICES) return;
    if (
      job.status === TranscriptionStatus.SUCCESS ||
      job.status === TranscriptionStatus.FAILED
    ) {
      return;
    }

    const inProgressBlock = this.buildWhisperMqBlock(job, payload, {
      text_content: '',
      segments: [],
    });
    const responses = this.whisperResponsesPayload(inProgressBlock);

    if (payload.status === 'await') {
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.PROCESSING,
        {
          responses,
          lastStatusCheckAt: new Date(),
        },
      );
      return;
    }

    if (payload.status === 'processing') {
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.PROCESSING,
        {
          responses,
          lastStatusCheckAt: new Date(),
        },
      );
      if (job.fileId) {
        await this.fileService.updateTranscriptionStatus(
          job.fileId,
          FileTranscriptionStatus.PROCESSING,
        );
      }
      return;
    }

    if (payload.status !== 'concluded') return;

    const errMsg = payload.error_message?.trim();
    if (errMsg) {
      const failedBlock = this.buildWhisperMqBlock(job, payload, {
        text_content: '',
        segments: [],
        error: errMsg,
      });
      await this.jobRepository.updateStatus(
        job.id,
        TranscriptionStatus.FAILED,
        {
          responses: this.whisperResponsesPayload(failedBlock),
          errorMessage: errMsg,
          finishedAt: new Date(),
          lastStatusCheckAt: new Date(),
        },
      );
      if (job.fileId) {
        await this.fileService.updateTranscriptionStatus(
          job.fileId,
          FileTranscriptionStatus.FAILED,
        );
      }
      const provider = await this.db.provider.findFirst({
        where: { name: ProviderName.TRANSCRIBE_SERVICES },
        select: { id: true },
      });
      if (provider) {
        const credential = await this.credentialRepository.findBestByProvider(
          provider.id,
        );
        await this.usageLogRepository.create({
          providerId: provider.id,
          providerCredentialId: credential?.id ?? null,
          aiModelId: null,
          status: TranscriptionStatus.FAILED,
          errorMessage: errMsg,
        });
      }
      return;
    }

    const text = (payload.text_content ?? '').trim();
    const segmentsRaw = Array.isArray(payload.segments) ? payload.segments : [];
    const segmentsForSrt = segmentsRaw as Array<{
      start: number;
      end: number;
      text: string;
    }>;
    const doneBlock = this.buildWhisperMqBlock(job, payload, {
      text_content: (payload.text_content ?? '').trim() || text,
      segments: segmentsRaw,
    });

    let canonical = buildCanonicalTranscriptionResponses(doneBlock);
    const segs = canonical.segments as Record<string, unknown>[];
    const fromCanon = canonicalSegmentsToSrt(Array.isArray(segs) ? segs : []);
    const srtFallback =
      segmentsForSrt.length > 0
        ? this.segmentsToSrt(segmentsForSrt)
        : this.singleSegmentSrt(text);
    if (!fromCanon.trim() && srtFallback.trim()) {
      const plain =
        (typeof canonical.text === 'string' && canonical.text.trim()) || text;
      const t = plain || srtFallback;
      canonical = {
        ...canonical,
        text: t,
        segments: [{ id: 0, start: 0, end: 0, text: t }],
      };
    }

    await this.jobRepository.updateStatus(job.id, TranscriptionStatus.SUCCESS, {
      responses: canonical,
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
    const provider = await this.db.provider.findFirst({
      where: { name: ProviderName.TRANSCRIBE_SERVICES },
      select: { id: true },
    });
    if (provider) {
      const credential = await this.credentialRepository.findBestByProvider(
        provider.id,
      );
      await this.usageLogRepository.create({
        providerId: provider.id,
        providerCredentialId: credential?.id ?? null,
        aiModelId: null,
        status: TranscriptionStatus.SUCCESS,
      });
    }
  }
}
