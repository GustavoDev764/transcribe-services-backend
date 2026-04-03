import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import {
  SYSTEM_CONFIG_KEYS,
  type SystemConfigKey,
} from '@app/data/system-config/system-config-keys';

export { SYSTEM_CONFIG_KEYS, type SystemConfigKey };

@Injectable()
export class SystemConfigService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async getConfig(key: string): Promise<string | null> {
    const config = await this.db.systemConfig.findUnique({
      where: { id: key },
    });
    return config?.value ?? null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.db.systemConfig.upsert({
      where: { id: key },
      create: { id: key, value },
      update: { value },
    });
  }
}
