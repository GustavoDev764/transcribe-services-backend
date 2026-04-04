import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import { AIProvider } from '@app/protocols/transcription/providers/ai-provider';
import { OpenAIProvider } from '@app/infrastructure/transcription/providers/openai.provider';
import { ElevenLabsProvider } from '@app/infrastructure/transcription/providers/elevenlabs.provider';
import { TranscribeServicesProvider } from '@app/infrastructure/transcription/providers/transcribe-services.provider';

@Injectable()
export class ProviderFactory {
  constructor(@Inject(APP_CONFIG) private readonly config: IEnvConfig) {}

  create(providerName: ProviderName, apiKey: string): AIProvider {
    if (providerName === ProviderName.OPENAI) {
      return new OpenAIProvider(apiKey);
    }
    if (providerName === ProviderName.ELEVENLABS) {
      return new ElevenLabsProvider(apiKey);
    }
    if (providerName === ProviderName.TRANSCRIBE_SERVICES) {
      const mq = this.config.RABBITMQ_URL?.trim();
      if (mq) {
        const host =
          this.config.TRANSCRIBE_HOST?.trim() || 'http://127.0.0.1:1';
        return new TranscribeServicesProvider(host, apiKey ?? '');
      }
      const host = this.config.TRANSCRIBE_HOST?.trim();
      if (!host) {
        throw new Error(
          'Configure RABBITMQ_URL (fila Whisper) ou TRANSCRIBE_HOST (API HTTP)',
        );
      }
      return new TranscribeServicesProvider(host, apiKey ?? '');
    }
    throw new Error('Provider não suportado');
  }
}
