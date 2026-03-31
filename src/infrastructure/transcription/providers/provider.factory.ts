import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { AIProvider } from '@app/protocols/transcription/providers/ai-provider';
import { OpenAIProvider } from '@app/infrastructure/transcription/providers/openai.provider';
import { GoogleProvider } from '@app/infrastructure/transcription/providers/google.provider';
import { TranscribeServicesProvider } from '@app/infrastructure/transcription/providers/transcribe-services.provider';

@Injectable()
export class ProviderFactory {
  constructor(@Inject(APP_CONFIG) private readonly config: IEnvConfig) {}

  create(providerName: string, apiKey: string): AIProvider {
    if (providerName === 'OPENAI') {
      return new OpenAIProvider(apiKey);
    }
    if (providerName === 'GOOGLE_SPEECH') {
      return new GoogleProvider();
    }
    if (providerName === 'TRANSCRIBE_SERVICES') {
      const host = this.config.TRANSCRIBE_HOST?.trim();
      if (!host) {
        throw new Error('TRANSCRIBE_HOST não configurado no ambiente');
      }
      return new TranscribeServicesProvider(host, apiKey ?? '');
    }
    throw new Error('Provider não suportado');
  }
}
