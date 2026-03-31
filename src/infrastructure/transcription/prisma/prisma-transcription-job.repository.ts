import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { TranscriptionJobRecord, TranscriptionJobRepository } from '@app/protocols/transcription/repositories/transcription-job.repository';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';
import { ProviderAttempt } from '@app/domain/transcription/entities/transcription-job.entity';

@Injectable()
export class PrismaTranscriptionJobRepository implements TranscriptionJobRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async create(data: {
    fileId?: string | null;
    fileUrl: string;
    provider?: string | null;
    externalJobId?: string | null;
    preferredModel?: string | null;
  }): Promise<TranscriptionJobRecord> {
    const job = await this.db.transcriptionJob.create({
      data: {
        fileId: data.fileId ?? null,
        fileUrl: data.fileUrl,
        provider: data.provider ?? null,
        externalJobId: data.externalJobId ?? null,
        preferredModel: data.preferredModel ?? null,
        status: TranscriptionStatus.PENDING,
        providerAttempts: [],
      },
    });
    return {
      id: job.id,
      fileId: job.fileId,
      fileUrl: job.fileUrl,
      provider: job.provider,
      externalJobId: job.externalJobId,
      preferredModel: job.preferredModel,
      status: job.status as TranscriptionStatus,
      providerAttempts: (job.providerAttempts as ProviderAttempt[]) ?? [],
      responses: job.responses ?? null,
      resultUrl: job.resultUrl,
      resultText: job.resultText,
      errorMessage: job.errorMessage,
      attempts: job.attempts,
      lastStatusCheckAt: job.lastStatusCheckAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async findById(id: string): Promise<TranscriptionJobRecord | null> {
    const job = await this.db.transcriptionJob.findUnique({ where: { id } });
    if (!job) return null;
    return {
      id: job.id,
      fileId: job.fileId,
      fileUrl: job.fileUrl,
      provider: job.provider,
      externalJobId: job.externalJobId,
      preferredModel: job.preferredModel,
      status: job.status as TranscriptionStatus,
      providerAttempts: (job.providerAttempts as ProviderAttempt[]) ?? [],
      responses: job.responses ?? null,
      resultUrl: job.resultUrl,
      resultText: job.resultText,
      errorMessage: job.errorMessage,
      attempts: job.attempts,
      lastStatusCheckAt: job.lastStatusCheckAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async findPendingExternalSyncJobsByFileIds(
    fileIds: string[],
    minLastCheckBefore: Date,
  ): Promise<Array<{ id: string }>> {
    if (!fileIds.length) return [];
    const rows = await this.db.transcriptionJob.findMany({
      where: {
        fileId: { in: fileIds },
        provider: 'TRANSCRIBE_SERVICES',
        externalJobId: { not: null },
        status: { in: [TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING] },
        OR: [
          { lastStatusCheckAt: null },
          { lastStatusCheckAt: { lte: minLastCheckBefore } },
        ],
      },
      select: { id: true },
    });
    return rows;
  }

  async updateStatus(
    id: string,
    status: TranscriptionStatus,
    data?: {
      providerAttempts?: ProviderAttempt[];
      responses?: unknown | null;
      resultUrl?: string | null;
      resultText?: string | null;
      errorMessage?: string | null;
      externalJobId?: string | null;
      provider?: string | null;
      lastStatusCheckAt?: Date | null;
      attemptsIncrement?: boolean;
      finishedAt?: Date | null;
    },
  ): Promise<void> {
    const responsesValue =
      data?.responses === undefined
        ? undefined
        : data.responses === null
          ? Prisma.DbNull
          : (data.responses as Prisma.InputJsonValue);
    await this.db.transcriptionJob.update({
      where: { id },
      data: {
        status,
        providerAttempts: data?.providerAttempts,
        responses: responsesValue,
        resultUrl: data?.resultUrl,
        resultText: data?.resultText,
        errorMessage: data?.errorMessage,
        provider: data?.provider,
        externalJobId: data?.externalJobId,
        lastStatusCheckAt: data?.lastStatusCheckAt,
        attempts: data?.attemptsIncrement ? { increment: 1 } : undefined,
        finishedAt: data?.finishedAt,
      },
    });
  }
}
