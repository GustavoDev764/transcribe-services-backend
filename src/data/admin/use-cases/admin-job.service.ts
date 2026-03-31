import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, TranscriptionStatus } from '@prisma/client';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { ListJobsQueryDto } from '@app/presentation/admin/requests/list-jobs.dto';
import { UpdateJobDto } from '@app/presentation/admin/requests/update-job.dto';

@Injectable()
export class AdminJobService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    @InjectQueue('transcription') private readonly transcriptionQueue: Queue,
  ) {}

  async listJobs(query: ListJobsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TranscriptionJobWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.fileUrl ? { fileUrl: { contains: query.fileUrl } } : {}),
    };

    const [jobs, total, waitingJobs, grouped] = await Promise.all([
      this.db.transcriptionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.transcriptionJob.count({ where }),
      this.transcriptionQueue.getWaiting(),
      this.db.transcriptionJob.groupBy({
        by: ['status'],
        _count: { _all: true },
        where,
      }),
    ]);

    const waitingMap = new Map<string, number>();
    waitingJobs.forEach((j, idx) => {
      if (j.id) waitingMap.set(String(j.id), idx + 1);
    });

    const now = Date.now();
    const data = jobs.map((job) => {
      const queuePosition = waitingMap.get(job.id) ?? null;
      return {
        id: job.id,
        fileUrl: job.fileUrl,
        status: job.status,
        queuePosition,
        updatedAt: job.updatedAt,
        createdAt: job.createdAt,
        waitSeconds: Math.floor((now - job.createdAt.getTime()) / 1000),
        errorMessage: job.errorMessage,
        responses: job.responses ?? null,
      };
    });

    return {
      data,
      statusCounts: grouped.reduce(
        (acc, item) => {
          acc[item.status] = item._count._all;
          return acc;
        },
        {} as Record<string, number>,
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateJobByManager(jobId: string, userId: string, dto: UpdateJobDto) {
    const current = await this.db.transcriptionJob.findUnique({
      where: { id: jobId },
    });
    if (!current) {
      throw new Error('Job não encontrado');
    }
    const nextStatus = dto.status ?? current.status;
    const nextErrorMessage =
      dto.errorMessage === undefined ? current.errorMessage : dto.errorMessage;
    const nextResponses =
      dto.responses === undefined ? current.responses : dto.responses;

    const responsesValue =
      dto.responses === undefined
        ? undefined
        : dto.responses === null
          ? Prisma.DbNull
          : (dto.responses as Prisma.InputJsonValue);
    const previousResponsesValue =
      current.responses === null
        ? Prisma.DbNull
        : current.responses === undefined
          ? undefined
          : (current.responses as Prisma.InputJsonValue);
    const newResponsesValue =
      nextResponses === null
        ? Prisma.DbNull
        : nextResponses === undefined
          ? undefined
          : (nextResponses as Prisma.InputJsonValue);

    const finishedAt =
      nextStatus === TranscriptionStatus.SUCCESS ||
      nextStatus === TranscriptionStatus.FAILED
        ? new Date()
        : null;

    await this.db.$transaction([
      this.db.transcriptionJob.update({
        where: { id: jobId },
        data: {
          status: nextStatus,
          responses: responsesValue,
          errorMessage: nextErrorMessage,
          finishedAt,
        },
      }),
      this.db.transcriptionJobAuditLog.create({
        data: {
          transcriptionJobId: jobId,
          userId,
          previousStatus: current.status,
          newStatus: nextStatus,
          previousResponses: previousResponsesValue,
          newResponses: newResponsesValue,
          previousErrorMessage: current.errorMessage,
          newErrorMessage: nextErrorMessage,
        },
      }),
    ]);

    return this.db.transcriptionJob.findUnique({ where: { id: jobId } });
  }
}
