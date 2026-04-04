import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { APP_CONFIG } from '@app/config/env.config';
import type { IEnvConfig } from '@app/config/env.interface';
import { SYSTEM_CONFIG_KEYS } from '@app/data/system-config/system-config-keys';
import { runInitialSeed } from '@app/data/initial-seed/initial-seed.runner';

const KEY = SYSTEM_CONFIG_KEYS.INITIAL_SEED_COMPLETED;

@Injectable()
export class InitialSeedService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
  ) {}

  async getStatus(): Promise<{ completed: boolean; completedAt?: string }> {
    const row = await this.db.systemConfig.findUnique({ where: { id: KEY } });
    if (!row) {
      return { completed: false };
    }
    try {
      const parsed = JSON.parse(row.value) as { completedAt?: string };
      return {
        completed: true,
        completedAt: parsed.completedAt,
      };
    } catch {
      return { completed: true };
    }
  }

  async executeOnce(opts?: {
    managerEmail?: string;
    managerPassword?: string;
  }): Promise<{ completedAt: string }> {
    const existing = await this.db.systemConfig.findUnique({
      where: { id: KEY },
    });
    if (existing) {
      throw new ConflictException(
        'Seed inicial já foi executado. Remova o registro em system_configs se precisar repetir (não recomendado).',
      );
    }

    const email =
      opts?.managerEmail?.trim() || this.config.MANAGER_EMAIL.trim();
    const password = opts?.managerPassword ?? this.config.MANAGER_PASSWORD;

    if (email === '' || password.trim() === '') {
      throw new BadRequestException(
        'Credenciais do gestor inválidas (corpo da requisição ou ambiente).',
      );
    }

    const completedAt = new Date().toISOString();

    await this.db.$transaction(async (tx) => {
      await runInitialSeed(tx, {
        managerEmail: email,
        managerPassword: password,
      });
      await tx.systemConfig.create({
        data: {
          id: KEY,
          value: JSON.stringify({ completedAt }),
        },
      });
    });

    return { completedAt };
  }
}
