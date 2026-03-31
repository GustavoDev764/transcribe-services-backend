import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class GetFileBufferUseCase {
  constructor(
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
  ) {}

  private getStorageDir() {
    return this.config.STORAGE_PATH;
  }

  private buildStorageFileName(fileId: string, storageExt: string) {
    return `${fileId}${storageExt}`;
  }

  private getStorageFilePath(fileId: string, storageExt: string): string {
    const storageDir = this.getStorageDir();
    return path.join(storageDir, this.buildStorageFileName(fileId, storageExt));
  }

  async execute(fileId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const file = await this.db.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    const fullPath = this.getStorageFilePath(file.id, file.storageExt);
    try {
      const buffer = await fs.readFile(fullPath);
      return { buffer, fileName: file.originalName };
    } catch {
      throw new NotFoundException('Arquivo não encontrado');
    }
  }

  async getFileSizeBytes(fileId: string): Promise<number> {
    const file = await this.db.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    const fullPath = this.getStorageFilePath(file.id, file.storageExt);
    try {
      const st = await fs.stat(fullPath);
      return st.size;
    } catch {
      throw new NotFoundException('Arquivo não encontrado');
    }
  }
}
