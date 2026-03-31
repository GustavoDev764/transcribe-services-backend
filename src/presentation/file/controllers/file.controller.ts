import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from '@app/data/file/use-cases/file.service';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@app/presentation/auth/guards/permission.guard';
import { RequirePermission } from '@app/presentation/auth/decorators/require-permission.decorator';
import { CurrentUser } from '@app/presentation/auth/decorators/current-user.decorator';
import { UserEntity } from '@app/domain/auth/entities/user.entity';
import { PERMISSIONS } from '@app/domain/constants/permissions.constants';
import { multerConfig } from '@app/infrastructure/file/multer.config';
import { TranscriptionMode } from '@prisma/client';
import { Readable } from 'stream';
import { PaginationQueryDto } from '@app/domain/dtos/pagination.dto';
import { UpdateSegmentDto } from '@app/presentation/file/requests/update-segment.dto';

@Controller('files')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FileController {
  constructor(
    private readonly fileService: FileService,
  ) {}

  private normalizeMode(mode?: string): TranscriptionMode {
    if (!mode) return 'GOLFINHO';
    const upper = mode.toUpperCase();
    if (upper === 'CHITA' || upper === 'GOLFINHO' || upper === 'BALEIA') {
      return upper as TranscriptionMode;
    }
    if (upper === 'FAST') return 'CHITA';
    if (upper === 'BALANCED') return 'GOLFINHO';
    if (upper === 'ACCURATE') return 'BALEIA';
    return 'GOLFINHO';
  }

  @Get('recent')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  findRecent(
    @CurrentUser() user: UserEntity,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fileService.findRecentByUser(
      user.id,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }

  @Get('favorites')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  findFavorites(
    @CurrentUser() user: UserEntity,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fileService.findFavoritesByUser(
      user.id,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }

  @Get('folder/:folderId')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  findByFolder(
    @Param('folderId') folderId: string,
    @CurrentUser() user: UserEntity,
    @Query() query: PaginationQueryDto,
  ) {
    return this.fileService.findByFolder(
      folderId,
      user.id,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }

  @Post('upload')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async upload(
    @CurrentUser() user: UserEntity,
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string },
    @Query('folderId') folderId?: string,
    @Query('mode') mode?: string,
    @Query('language') language?: string,
    @Query('batchId') batchId?: string,
  ) {
    if (!file) throw new Error('Nenhum arquivo enviado');
    const created = await this.fileService.create(user.id, file, {
      folderId: folderId || undefined,
      mode: this.normalizeMode(mode),
      language: language || 'pt-BR',
      batchId: batchId || undefined,
    });
    await this.fileService.enqueueConversion(created.id);
    return created;
  }

  @Post('upload-multiple')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
  async uploadMultiple(
    @CurrentUser() user: UserEntity,
    @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; mimetype: string }>,
    @Query('folderId') folderId?: string,
    @Query('mode') mode?: string,
    @Query('language') language?: string,
    @Query('batchId') batchId?: string,
  ) {
    if (!files?.length) throw new Error('Nenhum arquivo enviado');
    const results: unknown[] = [];
    for (const file of files) {
      const f = await this.fileService.create(user.id, file, {
        folderId: folderId || undefined,
        mode: this.normalizeMode(mode),
        language: language || 'pt-BR',
        batchId: batchId || undefined,
      });
      await this.fileService.enqueueConversion(f.id);
      results.push(f);
    }
    return results;
  }

  @Post('batches')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  async createBatch(@CurrentUser() user: UserEntity) {
    return this.fileService.createOrGetBatchWithFiles(user.id);
  }

  @Get('batches/:id')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  async getBatch(
    @Param('id') batchId: string,
    @CurrentUser() user: UserEntity,
  ) {
    const batch = await this.fileService.getBatch(batchId, user.id);
    if (!batch) throw new NotFoundException('Lote não encontrado');
    const files = await this.fileService.listDraftsByBatch(batchId, user.id);
    return { batch, files };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.fileService.findOne(id, user.id);
  }

  @Get(':id/transcription')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  async getTranscription(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    const file = await this.fileService.findOne(id, user.id);
    const job = await this.fileService.findTranscriptionJobByFileId(id);
    if (!job) throw new NotFoundException('Transcrição não encontrada');
    return {
      file: {
        id: file.id,
        originalName: file.originalName,
        urlFile: file.urlFile,
        duration: file.duration,
        transcriptionStatus: file.transcriptionStatus,
        createdAt: file.createdAt,
      },
      job: {
        id: job.id,
        status: job.status,
        responses: job.responses ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    };
  }

  @Put(':id/transcription/segments/:segmentId')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  async updateSegment(
    @Param('id') id: string,
    @Param('segmentId') segmentId: string,
    @Body() body: UpdateSegmentDto,
    @CurrentUser() user: UserEntity,
  ) {
    await this.fileService.findOne(id, user.id);
    const responses = await this.fileService.updateTranscriptionSegmentText(
      id,
      segmentId,
      body.text,
    );
    return { responses };
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { originalName?: string; folderId?: string | null; isFavorite?: boolean },
  ) {
    return this.fileService.updateMetadata(id, user.id, {
      originalName: body.originalName,
      folderId: body.folderId,
      isFavorite: body.isFavorite,
    });
  }

  @Get(':id/srt')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  async downloadSrt(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<StreamableFile> {
    const file = await this.fileService.findOne(id, user.id);
    if (!file.transcriptionText) throw new NotFoundException('SRT ainda não gerado');
    const stream = Readable.from([file.transcriptionText]);
    return new StreamableFile(stream, {
      type: 'text/plain',
      disposition: `attachment; filename="${file.originalName.replace(/\.(mp3|mpeg|webm|ogg|wav|m4a)$/i, '')}.srt"`,
    });
  }

  @Get(':id/download')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<StreamableFile> {
    const file = await this.fileService.findOne(id, user.id);
    const storageExt = (file as unknown as { storageExt: string }).storageExt;
    const filePath = this.fileService.getStorageFilePath(file.id, storageExt);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Arquivo não encontrado');
    }
    const stream = createReadStream(filePath);
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${file.originalName}"`,
    });
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.UPLOAD_WRITE)
  remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.fileService.remove(id, user.id);
  }
}
