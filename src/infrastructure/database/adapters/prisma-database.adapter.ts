import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';

/**
 * Adapter de banco de dados usando Prisma.
 * Implementação isolada - o restante do código não deve referenciar "Prisma".
 * Para trocar de ORM, crie outro adapter e atualize o DatabaseModule.
 * O pool e o adapter são injetados via useFactory no DatabaseModule (a partir de APP_CONFIG).
 */
@Injectable()
export class PrismaDatabaseAdapter
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly pool: Pool,
    adapter: PrismaPg,
  ) {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
