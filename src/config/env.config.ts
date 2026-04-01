import type { IEnvConfig } from '@app/config/env.interface';
import { resolveDatabaseUrl } from '@app/config/resolve-database-url';

function env(key: string, defaultValue: string): string {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : defaultValue;
}

function envNumber(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultValue;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

/**
 * Carrega e retorna o objeto de configuração a partir do .env.
 * Deve ser chamado após o dotenv estar carregado.
 */
export function loadConfigEnv(): IEnvConfig {
  const dbHost = env('DB_HOST', 'localhost');
  const dbPort = env('DB_PORT', '5432');
  const dbUser = env('DB_USER', 'postgres');
  const dbPassword = env('DB_PASSWORD', '');
  const dbName = env('DB_NAME', 'vidwave');

  const databaseUrl = resolveDatabaseUrl();

  return {
    HOST_PORT: envNumber('HOST_PORT', 3000),
    DATABASE_URL: databaseUrl,
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_NAME: dbName,
    JWT_SECRET: env('JWT_SECRET', 'default-secret'),
    JWT_EXPIRES_IN: env('JWT_EXPIRES_IN', '7d'),
    REDIS_HOST: env('REDIS_HOST', 'localhost'),
    REDIS_PORT: envNumber('REDIS_PORT', 6379),
    UPLOAD_PATH: env('UPLOAD_PATH', './uploads'),
    STORAGE_PATH: env('STORAGE_PATH', './storage'),
    MANAGER_EMAIL: env('MANAGER_EMAIL', ''),
    MANAGER_PASSWORD: env('MANAGER_PASSWORD', ''),
    GOOGLE_TRANSLATE_CREDENTIALS_KEY: env(
      'GOOGLE_TRANSLATE_CREDENTIALS_KEY',
      'GOOGLE_TRANSLATE_CREDENTIALS_JSON',
    ),
    GOOGLE_TRANSLATE_BASE: env(
      'GOOGLE_TRANSLATE_BASE',
      'https://translation.googleapis.com/language/translate/v2',
    ),
    GOOGLE_TRANSLATE_Q_BATCH_SIZE: Math.min(
      500,
      Math.max(1, envNumber('GOOGLE_TRANSLATE_Q_BATCH_SIZE', 400)),
    ),
    GOOGLE_TRANSLATE_PARALLEL_REQUESTS: Math.min(
      20,
      Math.max(1, envNumber('GOOGLE_TRANSLATE_PARALLEL_REQUESTS', 5)),
    ),
    GOOGLE_CLOUD_SCOPE: env(
      'GOOGLE_CLOUD_SCOPE',
      'https://www.googleapis.com/auth/cloud-platform',
    ),
    TRANSCRIBE_HOST: env('TRANSCRIBE_HOST', ''),
  };
}

/** Token de injeção do config (use em providers) */
export const APP_CONFIG = Symbol('APP_CONFIG');

/** Singleton do config para uso fora do container (ex: main.ts) */
let configEnvInstance: IEnvConfig | null = null;

export function getConfigEnv(): IEnvConfig {
  if (!configEnvInstance) {
    configEnvInstance = loadConfigEnv();
  }
  return configEnvInstance;
}

export function setConfigEnvForTests(config: IEnvConfig | null): void {
  configEnvInstance = config;
}
