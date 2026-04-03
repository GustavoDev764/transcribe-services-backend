import type { IEnvConfig } from '@app/config/env.interface';

/** Lê em tempo de execução (process.env primeiro) — evita APP_CONFIG congelado sem PUBLIC_APP_URL/SECRET. */
export function resolveMqDownloadPublicBase(config: IEnvConfig): string {
  return (
    process.env.PUBLIC_APP_URL?.trim() ||
    config.PUBLIC_APP_URL?.trim() ||
    ''
  );
}

export function resolveMqDownloadSecret(config: IEnvConfig): string {
  return (
    process.env.WHISPER_MQ_DOWNLOAD_SECRET?.trim() ||
    config.WHISPER_MQ_DOWNLOAD_SECRET?.trim() ||
    ''
  );
}
