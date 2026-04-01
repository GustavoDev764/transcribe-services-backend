import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import {
  FileTranscriptionStatus,
  Prisma,
  TranscriptionMode,
  UploadBatchStatus,
} from '@prisma/client';
import { TranscriptionStatus } from '@app/domain/transcription/value-objects/transcription-status';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

type FileConvertJobData = { fileId: string; enqueueTranscription?: boolean };
type TranscriptionQueueJobData = {
  jobId?: string;
  transcriptionJobId?: string;
};

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private static readonly TRANSCRIBE_RECHECK_SECONDS = 30;

  constructor(
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    @InjectQueue('file-convert')
    private readonly convertQueue: Queue<FileConvertJobData>,
    @InjectQueue('transcription')
    private readonly transcriptionQueue: Queue<TranscriptionQueueJobData>,
  ) {
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }

  private async removeTranscriptionJobsForFile(fileId: string) {
    const filePath = this.buildDownloadUrl(fileId);

    const jobs = await this.db.transcriptionJob.findMany({
      where: { fileUrl: { endsWith: filePath } },
      select: { id: true },
    });
    if (!jobs.length) return;
    await Promise.allSettled(
      jobs.map((job) => this.transcriptionQueue.remove(job.id)),
    );
    await this.db.transcriptionJob.deleteMany({
      where: { id: { in: jobs.map((j) => j.id) } },
    });
  }

  private normalizeOriginalName(name: string, targetExt: string) {
    const ext = path.extname(name);
    const base = ext ? name.slice(0, -ext.length) : name;
    return `${base}${targetExt}`;
  }

  private getStorageDir() {
    return this.config.STORAGE_PATH;
  }

  private buildStorageFileName(fileId: string, storageExt: string) {
    return `${fileId}${storageExt}`;
  }

  getStorageFilePath(fileId: string, storageExt: string): string {
    const storageDir = this.getStorageDir();
    return path.join(storageDir, this.buildStorageFileName(fileId, storageExt));
  }

  async getStorageFileBuffer(
    fileId: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const file = await this.db.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    const fullPath = this.getStorageFilePath(file.id, file.storageExt);
    const buffer = await fs.readFile(fullPath);
    return { buffer, fileName: file.originalName };
  }

  buildDownloadUrl(fileId: string): string {
    return `/files/${fileId}/download`;
  }

  private async convertFileToMp3(inputPath: string, outputPath: string) {
    if (!ffmpegPath) {
      throw new Error('FFmpeg não encontrado para conversão');
    }
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioQuality(2)
        .format('mp3')
        .on('end', () => resolve())
        .on('error', (err: Error) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        )
        .save(outputPath);
    });
  }

  async enqueueConversion(fileId: string, enqueueTranscription = false) {
    const jobId = `convert-${fileId}`;
    const existing = await this.convertQueue.getJob(jobId);
    if (existing) {
      if (enqueueTranscription && !existing.data.enqueueTranscription) {
        await existing.updateData({
          ...existing.data,
          enqueueTranscription: true,
        });
      }
      return;
    }
    await this.convertQueue.add(
      'convert',
      { fileId, enqueueTranscription },
      { jobId, removeOnComplete: true, removeOnFail: 10 },
    );
  }

  async create(
    userId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string },
    options: {
      folderId?: string;
      mode?: TranscriptionMode;
      language?: string;
      batchId?: string;
    } = {},
  ) {
    if (options.batchId) {
      const batch = await this.getBatch(options.batchId, userId);
      if (!batch) throw new NotFoundException('Lote não encontrado');
    }
    const storageDir = this.getStorageDir();
    await fs.mkdir(storageDir, { recursive: true });

    const ext = path.extname(file.originalname) || '.webm';
    const fileId = uuidv4();
    const storageExt = ext.toLowerCase();
    const fullPath = this.getStorageFilePath(fileId, storageExt);

    await fs.writeFile(fullPath, file.buffer);

    const shouldConvert = !['audio/mpeg', 'audio/mp3'].includes(file.mimetype);
    const normalizedName = shouldConvert
      ? this.normalizeOriginalName(file.originalname, '.mp3')
      : file.originalname;

    return this.db.file.create({
      data: {
        id: fileId,
        originalName: normalizedName,
        urlFile: this.buildDownloadUrl(fileId),
        storageExt,
        userId,
        folderId: options.folderId,
        mode: options.mode || 'GOLFINHO',
        language: options.language || 'pt-BR',
        batchId: options.batchId,
        transcriptionStatus: FileTranscriptionStatus.NOT_STARTED,
      },
    });
  }

  async convertStorageFileToMp3(fileId: string) {
    const file = await this.db.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    if (file.storageExt.toLowerCase() === '.mp3') return file;

    const storageDir = this.getStorageDir();
    await fs.mkdir(storageDir, { recursive: true });

    const inputPath = this.getStorageFilePath(file.id, file.storageExt);
    const outputExt = '.mp3';
    const outputPath = this.getStorageFilePath(file.id, outputExt);
    await this.convertFileToMp3(inputPath, outputPath);

    const updated = await this.db.file.update({
      where: { id: fileId },
      data: {
        storageExt: outputExt,
        originalName: this.normalizeOriginalName(file.originalName, '.mp3'),
      },
    });

    try {
      await fs.unlink(inputPath);
    } catch {
      void 0;
    }

    return updated;
  }

  private extractDurationFromLog(log: string): number | null {
    const match = log.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/i);
    if (!match) return null;
    const hh = Number(match[1] || '0');
    const mm = Number(match[2] || '0');
    const ss = Number(match[3] || '0');
    const fracRaw = match[4] || '0';
    const frac = Number(`0.${fracRaw}`);
    const totalSeconds = hh * 3600 + mm * 60 + ss + frac;
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  }

  private probeDurationSeconds(filePath: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
      if (!ffmpegPath) {
        reject(new Error('FFmpeg não encontrado para extração de duração'));
        return;
      }
      const proc = spawn(ffmpegPath, ['-i', filePath, '-f', 'null', '-']);
      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      proc.on('error', (err) => reject(err));
      proc.on('close', () => {
        resolve(this.extractDurationFromLog(stderr));
      });
    });
  }

  async updateDurationFromStorage(fileId: string): Promise<void> {
    const file = await this.db.file.findUnique({
      where: { id: fileId },
      select: { id: true, storageExt: true },
    });
    if (!file) return;
    const filePath = this.getStorageFilePath(file.id, file.storageExt);
    try {
      const duration = await this.probeDurationSeconds(filePath);
      if (duration === null) return;
      await this.db.file.update({
        where: { id: fileId },
        data: { duration: Math.max(0, Math.round(duration)) },
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao calcular duração do arquivo ${fileId}: ${
          err instanceof Error ? err.message : 'erro desconhecido'
        }`,
      );
    }
  }

  private parseTranscriptionProgressFromResponses(
    responses: unknown,
  ): number | null {
    if (!responses || typeof responses !== 'object') return null;
    const obj = responses as Record<string, unknown>;
    const raw = obj.progress;
    let n: number;
    if (typeof raw === 'number') n = raw;
    else if (typeof raw === 'string') n = Number.parseFloat(raw);
    else return null;
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (rounded < 0 || rounded >= 100) return null;
    return rounded;
  }

  private normalizeTranscribeModel(
    raw: string | null | undefined,
  ): 'tiny' | 'base' | 'small' | null {
    if (!raw || typeof raw !== 'string') return null;
    const k = raw.trim().toLowerCase();
    if (k === 'tiny' || k === 'base' || k === 'small') return k;
    return null;
  }

  private async buildLatestJobMetaByFileIds(fileIds: string[]): Promise<{
    progressByFileId: Map<string, number>;
    transcribeModelByFileId: Map<string, 'tiny' | 'base' | 'small'>;
  }> {
    if (!fileIds.length) {
      return {
        progressByFileId: new Map(),
        transcribeModelByFileId: new Map(),
      };
    }
    const jobs = await this.db.transcriptionJob.findMany({
      where: { fileId: { in: fileIds } },
      select: {
        fileId: true,
        responses: true,
        preferredModel: true,
        createdAt: true,
      },
    });
    const latestByFileId = new Map<
      string,
      {
        createdAt: Date;
        responses: Prisma.JsonValue | null;
        preferredModel: string | null;
      }
    >();
    for (const j of jobs) {
      if (!j.fileId) continue;
      const prev = latestByFileId.get(j.fileId);
      if (!prev || j.createdAt > prev.createdAt) {
        latestByFileId.set(j.fileId, {
          createdAt: j.createdAt,
          responses: j.responses,
          preferredModel: j.preferredModel,
        });
      }
    }
    const progressByFileId = new Map<string, number>();
    const transcribeModelByFileId = new Map<
      string,
      'tiny' | 'base' | 'small'
    >();
    for (const [fileId, row] of latestByFileId) {
      const p = this.parseTranscriptionProgressFromResponses(row.responses);
      if (p !== null) progressByFileId.set(fileId, p);
      const tm = this.normalizeTranscribeModel(row.preferredModel);
      if (tm) transcribeModelByFileId.set(fileId, tm);
    }
    return { progressByFileId, transcribeModelByFileId };
  }

  private async enqueueDurationBackfillForCompletedFiles(
    files: Array<{
      id: string;
      duration: number | null;
      transcriptionStatus: FileTranscriptionStatus;
    }>,
  ) {
    const eligible = files.filter(
      (f) =>
        f.duration === null &&
        f.transcriptionStatus === FileTranscriptionStatus.SUCCESS,
    );
    await Promise.all(eligible.map((f) => this.enqueueConversion(f.id)));
  }

  async findRecentByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      userId,
      transcriptionStatus: { not: FileTranscriptionStatus.NOT_STARTED },
    };
    const [files, total] = await Promise.all([
      this.db.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          urlFile: true,
          isFavorite: true,
          createdAt: true,
          duration: true,
          mode: true,
          transcriptionStatus: true,
        },
      }),
      this.db.file.count({ where }),
    ]);
    const fileIds = files.map((f) => f.id);
    await this.enqueueTranscribeStatusSyncForFiles(fileIds);
    await this.enqueueDurationBackfillForCompletedFiles(files);

    const { progressByFileId, transcribeModelByFileId } =
      await this.buildLatestJobMetaByFileIds(fileIds);

    return {
      data: files.map((f) => {
        const transcriptionProgress = progressByFileId.get(f.id);
        const transcribeModel = transcribeModelByFileId.get(f.id);
        return {
          id: f.id,
          originalName: f.originalName,
          urlFile: f.urlFile,
          isFavorite: f.isFavorite,
          createdAt: f.createdAt,
          duration: f.duration,
          mode: f.mode,
          transcriptionStatus: f.transcriptionStatus,
          ...(transcriptionProgress !== undefined
            ? { transcriptionProgress }
            : {}),
          ...(transcribeModel !== undefined ? { transcribeModel } : {}),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByFolder(folderId: string, userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      folderId,
      userId,
      transcriptionStatus: { not: FileTranscriptionStatus.NOT_STARTED },
    };
    const [files, total] = await Promise.all([
      this.db.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          urlFile: true,
          isFavorite: true,
          createdAt: true,
          duration: true,
          mode: true,
          transcriptionStatus: true,
        },
      }),
      this.db.file.count({ where }),
    ]);
    await this.enqueueDurationBackfillForCompletedFiles(files);
    const fileIds = files.map((f) => f.id);
    const { transcribeModelByFileId } =
      await this.buildLatestJobMetaByFileIds(fileIds);
    return {
      data: files.map((f) => {
        const transcribeModel = transcribeModelByFileId.get(f.id);
        return {
          id: f.id,
          originalName: f.originalName,
          urlFile: f.urlFile,
          isFavorite: f.isFavorite,
          createdAt: f.createdAt,
          duration: f.duration,
          mode: f.mode,
          transcriptionStatus: f.transcriptionStatus,
          ...(transcribeModel !== undefined ? { transcribeModel } : {}),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string) {
    const file = await this.db.file.findFirst({
      where: { id, userId },
    });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    return file;
  }

  private async enqueueTranscribeStatusSyncForFiles(fileIds: string[]) {
    if (!fileIds.length) return;
    const active = await this.db.provider.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    if (active.length !== 1 || active[0].name !== 'TRANSCRIBE_SERVICES') return;

    const minLastCheckBefore = new Date(
      Date.now() - FileService.TRANSCRIBE_RECHECK_SECONDS * 1000,
    );
    const pending = await this.db.transcriptionJob.findMany({
      where: {
        fileId: { in: fileIds },
        provider: 'TRANSCRIBE_SERVICES',
        externalJobId: { not: null },
        status: TranscriptionStatus.PROCESSING,
        OR: [
          { lastStatusCheckAt: null },
          { lastStatusCheckAt: { lte: minLastCheckBefore } },
        ],
      },
      select: { id: true },
    });
    await Promise.all(
      pending.map(async (j) => {
        try {
          await this.transcriptionQueue.add(
            'sync-status',
            { transcriptionJobId: j.id },
            {
              jobId: `sync-transcription-${j.id}`,
              attempts: 1,
              removeOnComplete: true,
              removeOnFail: true,
            },
          );
        } catch {
          void 0;
        }
      }),
    );
  }

  async updateDuration(id: string, userId: string, duration: number) {
    await this.findOne(id, userId);
    return this.db.file.update({
      where: { id },
      data: { duration },
    });
  }

  async updateTranscriptionStatus(id: string, status: FileTranscriptionStatus) {
    await this.db.file.update({
      where: { id },
      data: { transcriptionStatus: status },
    });
  }

  async listDraftsByBatch(batchId: string, userId: string) {
    return this.db.file.findMany({
      where: {
        batchId,
        userId,
        transcriptionStatus: FileTranscriptionStatus.NOT_STARTED,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        originalName: true,
        urlFile: true,
        createdAt: true,
        duration: true,
        transcriptionStatus: true,
      },
    });
  }

  async createOrGetBatchWithFiles(userId: string) {
    const existing = await this.db.uploadBatch.findFirst({
      where: { userId, status: UploadBatchStatus.NEW },
      orderBy: { createdAt: 'desc' },
    });
    const batch =
      existing ??
      (await this.db.uploadBatch.create({
        data: { userId },
      }));
    const files = await this.listDraftsByBatch(batch.id, userId);
    return { batch, files };
  }

  async getBatch(batchId: string, userId: string) {
    return this.db.uploadBatch.findFirst({
      where: { id: batchId, userId },
    });
  }

  async getBatchIdForFile(fileId: string) {
    const file = await this.db.file.findUnique({
      where: { id: fileId },
      select: { batchId: true },
    });
    return file?.batchId ?? null;
  }

  async markBatchFinished(batchId: string) {
    await this.db.uploadBatch.update({
      where: { id: batchId },
      data: { status: UploadBatchStatus.FINISH },
    });
  }

  async moveToFolder(id: string, userId: string, folderId: string | null) {
    await this.findOne(id, userId);
    return this.db.file.update({
      where: { id },
      data: { folderId },
    });
  }

  async updateMetadata(
    id: string,
    userId: string,
    data: {
      originalName?: string;
      folderId?: string | null;
      isFavorite?: boolean;
    },
  ) {
    await this.findOne(id, userId);
    return this.db.file.update({
      where: { id },
      data,
    });
  }

  async findFavoritesByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      userId,
      isFavorite: true,
      transcriptionStatus: { not: FileTranscriptionStatus.NOT_STARTED },
    };
    const [files, total] = await Promise.all([
      this.db.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          urlFile: true,
          isFavorite: true,
          createdAt: true,
          duration: true,
          mode: true,
          transcriptionStatus: true,
        },
      }),
      this.db.file.count({ where }),
    ]);

    const fileIds = files.map((f) => f.id);
    await this.enqueueTranscribeStatusSyncForFiles(fileIds);
    await this.enqueueDurationBackfillForCompletedFiles(files);
    const { progressByFileId, transcribeModelByFileId } =
      await this.buildLatestJobMetaByFileIds(fileIds);

    return {
      data: files.map((f) => {
        const transcriptionProgress = progressByFileId.get(f.id);
        const transcribeModel = transcribeModelByFileId.get(f.id);
        return {
          id: f.id,
          originalName: f.originalName,
          urlFile: f.urlFile,
          isFavorite: f.isFavorite,
          createdAt: f.createdAt,
          duration: f.duration,
          mode: f.mode,
          transcriptionStatus: f.transcriptionStatus,
          ...(transcriptionProgress !== undefined
            ? { transcriptionProgress }
            : {}),
          ...(transcribeModel !== undefined ? { transcribeModel } : {}),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async remove(id: string, userId: string) {
    const file = await this.findOne(id, userId);
    await this.removeTranscriptionJobsForFile(id);
    await this.deleteStorageFile(file.id, file.storageExt);
    const convertJob = await this.convertQueue.getJob(`convert-${id}`);
    if (convertJob) await convertJob.remove();
    return this.db.file.delete({ where: { id } });
  }

  async saveTranscription(id: string, transcriptionText: string) {
    return this.db.file.update({
      where: { id },
      data: { transcriptionText },
    });
  }

  async findTranscriptionJobByFileId(fileId: string) {
    return this.db.transcriptionJob.findFirst({
      where: {
        OR: [
          { fileId },
          { fileUrl: { endsWith: this.buildDownloadUrl(fileId) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTranscriptionSegmentText(
    fileId: string,
    segmentId: string,
    text: string,
  ) {
    const job = await this.findTranscriptionJobByFileId(fileId);
    if (!job) {
      throw new NotFoundException('Transcrição não encontrada');
    }
    const responses = job.responses as unknown;
    if (!responses || typeof responses !== 'object') {
      throw new NotFoundException('Resposta da transcrição não disponível');
    }

    const payload = responses as {
      task?: { text?: string };
      duration?: number;
      language?: string;
      segments?: Array<{
        id?: number | string;
        start?: number;
        end?: number;
        text?: string;
      }>;
    };

    if (!Array.isArray(payload.segments)) {
      throw new NotFoundException('Segmentos não encontrados');
    }

    const numericId = Number(segmentId);
    const indexMatch = Number.isFinite(numericId) ? numericId : null;
    const segment =
      payload.segments.find((seg) => String(seg.id) === segmentId) ??
      (indexMatch !== null ? payload.segments[indexMatch] : undefined);

    if (!segment) {
      throw new NotFoundException('Segmento não encontrado');
    }

    segment.text = text;

    const responsesValue =
      payload === null ? Prisma.DbNull : (payload as Prisma.InputJsonValue);
    await this.db.transcriptionJob.update({
      where: { id: job.id },
      data: { responses: responsesValue },
    });

    return payload;
  }

  async deleteStorageFile(fileId: string, storageExt: string) {
    const fullPath = this.getStorageFilePath(fileId, storageExt);
    try {
      await fs.unlink(fullPath);
    } catch {
      void 0;
    }
  }
}
