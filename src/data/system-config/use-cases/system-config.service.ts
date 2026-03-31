import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';

export const SYSTEM_CONFIG_KEYS = {
  EMAIL_TEMPLATE_RESET_PASSWORD: 'EMAIL_TEMPLATE_RESET_PASSWORD',
  EMAIL_TEMPLATE_ACCOUNT_CREATED: 'EMAIL_TEMPLATE_ACCOUNT_CREATED',
  EMAIL_TEMPLATE_ACCOUNT_DEACTIVATED: 'EMAIL_TEMPLATE_ACCOUNT_DEACTIVATED',
} as const;

export type SystemConfigKey =
  (typeof SYSTEM_CONFIG_KEYS)[keyof typeof SYSTEM_CONFIG_KEYS];

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
