import { Inject, Injectable, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';

export type WhisperMqJobPayload = {
  job_id: string;
  model: string;
  original_filename: string;

  file_path?: string;

  file_url?: string;
};

@Injectable()
export class WhisperMqPublisherService {
  private readonly logger = new Logger(WhisperMqPublisherService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: IEnvConfig) {}

  async publishJob(payload: WhisperMqJobPayload): Promise<boolean> {
    const url = this.config.RABBITMQ_URL?.trim();
    if (!url) {
      this.logger.warn('RABBITMQ_URL não configurado');
      return false;
    }
    const queue = this.config.WHISPER_JOBS_QUEUE;
    let connection: amqp.ChannelModel | null = null;
    try {
      connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        contentType: 'application/json',
      });
      await channel.close();
      return true;
    } catch (e) {
      const err = e as Error;
      this.logger.error(
        `Falha ao publicar job na fila Whisper: ${err.message}`,
      );
      return false;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch {
          void 0;
        }
      }
    }
  }
}
