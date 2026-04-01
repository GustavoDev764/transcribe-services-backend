export interface IEnvConfig {
  HOST_PORT: number;

  DATABASE_URL: string;

  DB_HOST: string;

  DB_PORT: string;

  DB_USER: string;

  DB_PASSWORD: string;

  DB_NAME: string;

  JWT_SECRET: string;

  JWT_EXPIRES_IN: string;

  REDIS_HOST: string;

  REDIS_PORT: number;

  UPLOAD_PATH: string;

  STORAGE_PATH: string;

  MANAGER_EMAIL: string;

  MANAGER_PASSWORD: string;

  GOOGLE_TRANSLATE_CREDENTIALS_KEY: string;

  GOOGLE_TRANSLATE_BASE: string;

  GOOGLE_TRANSLATE_Q_BATCH_SIZE: number;

  GOOGLE_TRANSLATE_PARALLEL_REQUESTS: number;

  GOOGLE_CLOUD_SCOPE: string;

  TRANSCRIBE_HOST: string;
}
