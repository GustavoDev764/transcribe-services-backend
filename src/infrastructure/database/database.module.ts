import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import { PrismaDatabaseAdapter } from '@app/infrastructure/database/adapters/prisma-database.adapter';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';

@Global()
@Module({
  providers: [
    {
      provide: PrismaDatabaseAdapter,
      useFactory: (config: IEnvConfig) => {
        const pool = new Pool({ connectionString: config.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        return new PrismaDatabaseAdapter(pool, adapter);
      },
      inject: [APP_CONFIG],
    },
    {
      provide: DATABASE_CLIENT,
      useExisting: PrismaDatabaseAdapter,
    },
  ],
  exports: [DATABASE_CLIENT, PrismaDatabaseAdapter],
})
export class DatabaseModule {}
