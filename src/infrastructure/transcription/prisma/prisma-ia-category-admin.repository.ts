import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { IaCategoryKind } from '@prisma/client';
import {
  IaCategoryAdminRepository,
  IaCategoryTipoCode,
  IaCategoryRecord,
} from '@app/protocols/transcription/repositories/admin-transcription.repository';

@Injectable()
export class PrismaIaCategoryAdminRepository implements IaCategoryAdminRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async list(): Promise<IaCategoryRecord[]> {
    const items = await this.db.iaCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return items.map((c) => this.toRecord(c));
  }

  async create(data: {
    name: string;
    tipo: IaCategoryTipoCode;
  }): Promise<IaCategoryRecord> {
    const c = await this.db.iaCategory.create({
      data: {
        name: data.name.trim(),
        tipo: data.tipo as IaCategoryKind,
      },
    });
    return this.toRecord(c);
  }

  async update(
    id: string,
    data: { name?: string; tipo?: IaCategoryTipoCode },
  ): Promise<IaCategoryRecord> {
    const c = await this.db.iaCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.tipo !== undefined && { tipo: data.tipo as IaCategoryKind }),
      },
    });
    return this.toRecord(c);
  }

  async delete(id: string): Promise<void> {
    await this.db.iaCategory.delete({ where: { id } });
  }

  private toRecord(c: {
    id: string;
    name: string;
    tipo: IaCategoryKind;
    createdAt: Date;
    updatedAt: Date;
  }): IaCategoryRecord {
    return {
      id: c.id,
      name: c.name,
      tipo: c.tipo as IaCategoryTipoCode,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
