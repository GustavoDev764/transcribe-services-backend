import { Injectable, Inject } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { SystemConfigService } from '@app/data/system-config/use-cases/system-config.service';
import { HttpClient, HttpClientError } from '@app/infrastructure/http/http-client';
import {
  TRANSLATE_LANGUAGE_NAMES,
  TRANSLATE_LANGUAGE_NAME_TO_CODE,
  GOOGLE_TRANSLATE_ENABLED_LANGUAGES_KEY,
} from '@app/data/translate/translate-languages.constants';

export interface LanguageOption {
  code: string;
  name: string;
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  sourceLanguage: string;
  targetLanguage: string;
}

@Injectable()
export class TranslateService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: IEnvConfig,
    private readonly systemConfig: SystemConfigService,
  ) {}

  private async getCredentialsJson(): Promise<string | null> {
    return this.systemConfig.getConfig(
      this.config.GOOGLE_TRANSLATE_CREDENTIALS_KEY,
    );
  }

  private async getAccessToken(): Promise<string> {
    const raw = await this.getCredentialsJson();
    if (!raw?.trim()) {
      throw new Error(
        'Google Tradutor não configurado. Em Configurações → Google (painel Manage), importe o arquivo JSON da conta de serviço do Google Cloud.',
      );
    }
    try {
      const credentials = JSON.parse(raw) as Record<string, unknown>;
      if (!credentials?.private_key || !credentials?.client_email) {
        throw new Error(
          'O JSON de credenciais é inválido. O arquivo deve ser o JSON da conta de serviço (com private_key e client_email).',
        );
      }
      const auth = new GoogleAuth({ scopes: [this.config.GOOGLE_CLOUD_SCOPE] });
      const client = auth.fromJSON(credentials);
      const res = await client.getAccessToken();
      const token = (res?.token as string) ?? null;
      if (!token) {
        throw new Error(
          'Não foi possível obter o token de acesso do Google. Verifique o JSON em Configurações → Google.',
        );
      }
      return token;
    } catch (err) {
      if (
        err instanceof Error &&
        !err.message.startsWith('Google Tradutor') &&
        !err.message.startsWith('O JSON')
      ) {
        throw new Error(
          'Falha ao autenticar com o Google. Verifique se o JSON é da conta de serviço e se a API Cloud Translation está ativada no projeto.',
        );
      }
      throw err;
    }
  }

  private async requestGoogleTranslate(
    path: string,
    options: { method: 'GET' | 'POST'; body?: object } = { method: 'GET' },
  ): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();
    const url = `${this.config.GOOGLE_TRANSLATE_BASE}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    try {
      const res = await HttpClient.request<Record<string, unknown>>(
        options.method,
        url,
        {
          headers,
          data: options.body,
        },
      );
      return res.data;
    } catch (e) {
      const err = e as HttpClientError;
      const data = err.data as { error?: { message?: string } } | undefined;
      const message = data?.error?.message || err.message;
      throw new Error(message);
    }
  }

  async getLanguages(target?: string): Promise<LanguageOption[]> {
    try {
      const t = encodeURIComponent(target || 'pt');
      const path = `/languages?target=${t}`;
      const data = await this.requestGoogleTranslate(path);
      const list =
        (data?.data as { languages?: { language: string; name: string }[] })
          ?.languages ?? [];
      return list.map((l) => ({ code: l.language, name: l.name }));
    } catch {
      return this.getFallbackLanguages();
    }
  }

  /**
   * Retorna apenas os idiomas habilitados no painel Manage (Config → Google).
   * Se nenhum estiver configurado, retorna todos da lista padrão.
   */
  async getEnabledLanguages(): Promise<LanguageOption[]> {
    const raw = await this.systemConfig.getConfig(
      GOOGLE_TRANSLATE_ENABLED_LANGUAGES_KEY,
    );
    let enabledNames: string[] = [];

    const hasConfig = raw !== null && raw !== undefined;
    if (hasConfig && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        enabledNames = Array.isArray(parsed)
          ? parsed.filter((x): x is string => typeof x === 'string')
          : [];
      } catch {
        enabledNames = [];
      }
    }
    const namesToUse = !hasConfig
      ? [...TRANSLATE_LANGUAGE_NAMES]
      : enabledNames.length > 0
        ? enabledNames
        : [];
    const map = TRANSLATE_LANGUAGE_NAME_TO_CODE;
    return namesToUse
      .filter((name) => map[name])
      .map((name) => ({ code: map[name], name }));
  }

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<TranslateResult> {
    const enabled = await this.getEnabledLanguages();
    const enabledCodes = new Set(enabled.map((l) => l.code));
    if (!enabledCodes.has(targetLanguage)) {
      throw new Error(
        'Idioma de destino não está habilitado. O administrador pode habilitar idiomas em Configurações → Google.',
      );
    }
    if (
      sourceLanguage &&
      sourceLanguage !== 'detect' &&
      sourceLanguage !== '' &&
      !enabledCodes.has(sourceLanguage)
    ) {
      throw new Error(
        'Idioma de origem não está habilitado. O administrador pode habilitar idiomas em Configurações → Google.',
      );
    }
    const body: {
      q: string[];
      target: string;
      source?: string;
      format?: string;
    } = {
      q: [text],
      target: targetLanguage,
      format: 'text',
    };
    if (
      sourceLanguage &&
      sourceLanguage !== 'detect' &&
      sourceLanguage !== ''
    ) {
      body.source = sourceLanguage;
    }
    const data = await this.requestGoogleTranslate('', {
      method: 'POST',
      body,
    });
    const translations = (
      data?.data as {
        translations?: {
          translatedText?: string;
          detectedSourceLanguage?: string;
        }[];
      }
    )?.translations;
    const translation = translations?.[0];
    if (!translation) {
      throw new Error('Resposta inválida do Google Tradutor');
    }
    const translatedText = translation.translatedText ?? '';
    const detectedSourceLanguage = translation.detectedSourceLanguage;
    const resolvedSource =
      sourceLanguage && sourceLanguage !== 'detect'
        ? sourceLanguage
        : detectedSourceLanguage || 'unknown';
    return {
      translatedText,
      detectedSourceLanguage: detectedSourceLanguage || undefined,
      sourceLanguage: resolvedSource,
      targetLanguage,
    };
  }

  private async translateTextsSingleRequest(
    texts: string[],
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<{ translations: string[]; detectedSourceLanguage?: string }> {
    const body: { q: string[]; target: string; source?: string; format?: string } = {
      q: texts,
      target: targetLanguage,
      format: 'text',
    };
    if (sourceLanguage && sourceLanguage !== 'detect' && sourceLanguage !== '') {
      body.source = sourceLanguage;
    }
    const data = await this.requestGoogleTranslate('', { method: 'POST', body });
    const list = (
      data?.data as {
        translations?: { translatedText?: string; detectedSourceLanguage?: string }[];
      }
    )?.translations ?? [];
    if (list.length !== texts.length) {
      throw new Error(
        `Resposta incompleta do Google Tradutor: esperado ${texts.length} traduções, recebido ${list.length}`,
      );
    }
    const translations = list.map((t) => String(t?.translatedText ?? ''));
    const detectedSourceLanguage = list[0]?.detectedSourceLanguage;
    return { translations, detectedSourceLanguage: detectedSourceLanguage || undefined };
  }

  /**
   * Traduz vários trechos (segmentos), em lotes dentro do limite da API, e devolve na mesma ordem.
   */
  async translateTexts(
    texts: string[],
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<{ translations: string[]; sourceLanguage: string; targetLanguage: string; detectedSourceLanguage?: string }> {
    const enabled = await this.getEnabledLanguages();
    const enabledCodes = new Set(enabled.map((l) => l.code));
    if (!enabledCodes.has(targetLanguage)) {
      throw new Error(
        'Idioma de destino não está habilitado. O administrador pode habilitar idiomas em Configurações → Google.',
      );
    }
    if (
      sourceLanguage &&
      sourceLanguage !== 'detect' &&
      sourceLanguage !== '' &&
      !enabledCodes.has(sourceLanguage)
    ) {
      throw new Error(
        'Idioma de origem não está habilitado. O administrador pode habilitar idiomas em Configurações → Google.',
      );
    }
    if (!texts.length) {
      return { translations: [], sourceLanguage: sourceLanguage ?? 'unknown', targetLanguage, detectedSourceLanguage: undefined };
    }

    const batch = this.config.GOOGLE_TRANSLATE_Q_BATCH_SIZE;
    const maxConcurrentRequests = this.config.GOOGLE_TRANSLATE_PARALLEL_REQUESTS;
    const chunks: string[][] = [];

    for (let i = 0; i < texts.length; i += batch) {
      chunks.push(texts.slice(i, i + batch));
    }

    const chunkResults: Array<{
      translations: string[];
      detectedSourceLanguage?: string;
    }> = new Array(chunks.length);

    let cursor = 0;
    const worker = async () => {
      while (cursor < chunks.length) {
        const chunkIndex = cursor++;
        const slice = chunks[chunkIndex];
        chunkResults[chunkIndex] = await this.translateTextsSingleRequest(
          slice,
          targetLanguage,
          sourceLanguage,
        );
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(maxConcurrentRequests, chunks.length) }, () => worker()),
    );

    const merged = chunkResults.flatMap((r) => r.translations);
    let lastDetected: string | undefined;
    for (const result of chunkResults) {
      if (result.detectedSourceLanguage) lastDetected = result.detectedSourceLanguage;
    }

    const resolvedSource =
      sourceLanguage && sourceLanguage !== 'detect'
        ? sourceLanguage
        : lastDetected || 'unknown';
    return {
      translations: merged,
      sourceLanguage: resolvedSource,
      targetLanguage,
      detectedSourceLanguage: lastDetected,
    };
  }

  private getFallbackLanguages(): LanguageOption[] {
    return [
      { code: 'pt', name: 'Português' },
      { code: 'en', name: 'Inglês' },
      { code: 'es', name: 'Espanhol' },
      { code: 'fr', name: 'Francês' },
      { code: 'de', name: 'Alemão' },
      { code: 'it', name: 'Italiano' },
      { code: 'ja', name: 'Japonês' },
      { code: 'ko', name: 'Coreano' },
      { code: 'zh-CN', name: 'Chinês (simplificado)' },
      { code: 'zh-TW', name: 'Chinês (tradicional)' },
      { code: 'ar', name: 'Árabe' },
      { code: 'ru', name: 'Russo' },
      { code: 'hi', name: 'Hindi' },
    ];
  }
}
