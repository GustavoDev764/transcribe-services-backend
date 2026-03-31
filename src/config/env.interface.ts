/**
 * Interface do arquivo .env.
 * Todas as variáveis de ambiente usadas pela aplicação.
 */
export interface IEnvConfig {
  /** Porta do servidor HTTP */
  HOST_PORT: number;
  /** URL de conexão com o PostgreSQL */
  DATABASE_URL: string;
  /** Host do PostgreSQL */
  DB_HOST: string;
  /** Porta do PostgreSQL */
  DB_PORT: string;
  /** Usuário do PostgreSQL */
  DB_USER: string;
  /** Senha do PostgreSQL */
  DB_PASSWORD: string;
  /** Nome do banco de dados */
  DB_NAME: string;
  /** Chave secreta para assinatura dos JWTs */
  JWT_SECRET: string;
  /** Tempo de expiração do JWT (ex: 7d) */
  JWT_EXPIRES_IN: string;
  /** Host do Redis */
  REDIS_HOST: string;
  /** Porta do Redis */
  REDIS_PORT: number;
  /** Diretório de upload de arquivos */
  UPLOAD_PATH: string;
  /** Diretório de armazenamento de arquivos */
  STORAGE_PATH: string;
  /** E-mail do administrador (seed) */
  MANAGER_EMAIL: string;
  /** Senha do administrador (seed) */
  MANAGER_PASSWORD: string;
  /** Chave no system-config onde está o JSON de credenciais do Google */
  GOOGLE_TRANSLATE_CREDENTIALS_KEY: string;
  /** URL base da API Google Translate */
  GOOGLE_TRANSLATE_BASE: string;
  /**
   * Máximo de strings em `q` por requisição em `translateTexts` (lotes concatenados na ordem).
   * Padrão 400; se o Google Basic v2 responder erro, use 128 em `GOOGLE_TRANSLATE_Q_BATCH_SIZE`.
   */
  GOOGLE_TRANSLATE_Q_BATCH_SIZE: number;
  /** Quantidade de requisições paralelas na tradução em lote (padrão: 5). */
  GOOGLE_TRANSLATE_PARALLEL_REQUESTS: number;
  /** Escopo OAuth para Google Cloud */
  GOOGLE_CLOUD_SCOPE: string;
  /** URL base da Transcribe Services API (ex: http://host:8000) */
  TRANSCRIBE_HOST: string;
}
