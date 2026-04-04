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

  REDISCLOUD_URL: string;

  REDIS_HOST: string;

  REDIS_PORT: number;

  REDIS_DB: number;

  UPLOAD_PATH: string;

  STORAGE_PATH: string;

  MANAGER_EMAIL: string;

  MANAGER_PASSWORD: string;

  INITIAL_SEED_SECRET: string;

  GOOGLE_TRANSLATE_CREDENTIALS_KEY: string;

  GOOGLE_TRANSLATE_BASE: string;

  GOOGLE_TRANSLATE_Q_BATCH_SIZE: number;

  GOOGLE_TRANSLATE_PARALLEL_REQUESTS: number;

  GOOGLE_CLOUD_SCOPE: string;

  TRANSCRIBE_HOST: string;

  RABBITMQ_URL: string;

  WHISPER_JOBS_QUEUE: string;

  WHISPER_STATUS_QUEUE: string;

  TRANSCRIPTION_SHARED_STORAGE_PATH: string;

  PUBLIC_APP_URL: string;

  WHISPER_MQ_DOWNLOAD_SECRET: string;

  WHISPER_MQ_DOWNLOAD_TTL_SEC: number;
}
