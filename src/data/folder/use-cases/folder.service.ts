import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { CreateFolderDto } from '@app/presentation/folder/requests/create-folder.dto';
import { UpdateFolderDto } from '@app/presentation/folder/requests/update-folder.dto';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class FolderService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
  ) {}

  async create(userId: string, dto: CreateFolderDto) {
    return this.db.folder.create({
      data: {
        name: dto.name,
        color: dto.color ?? '#60A5FA',
        userId,
      },
    });
  }

  async findAllByUser(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { userId };
    const [folders, total] = await Promise.all([
      this.db.folder.findMany({
        where,
        include: {
          _count: { select: { files: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.db.folder.count({ where }),
    ]);
    return {
      data: folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        createdAt: f.createdAt,
        _count: f._count,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string) {
    const folder = await this.db.folder.findFirst({
      where: { id, userId },
      include: { files: true },
    });
    if (!folder) throw new NotFoundException('Pasta não encontrada');
    return folder;
  }

  async update(id: string, userId: string, dto: UpdateFolderDto) {
    await this.findOne(id, userId);
    return this.db.folder.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    const files = await this.db.file.findMany({
      where: { folderId: id, userId },
      select: { id: true, storageExt: true },
    });
    await Promise.all(
      files.map((f) => this.deleteStorageFile(f.id, f.storageExt)),
    );
    await this.db.file.deleteMany({ where: { folderId: id, userId } });
    return this.db.folder.delete({ where: { id } });
  }

  private async deleteStorageFile(fileId: string, storageExt: string) {
    const storageDir = this.config.STORAGE_PATH;
    const fullPath = path.join(storageDir, `${fileId}${storageExt}`);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore
    }
  }
}
