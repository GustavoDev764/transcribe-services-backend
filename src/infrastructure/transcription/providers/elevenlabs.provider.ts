import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import type { SpeechToTextConvertRequestModelId } from '@elevenlabs/elevenlabs-js/api/resources/speechToText/types/SpeechToTextConvertRequestModelId';
import type {
  MultichannelSpeechToTextResponseModel,
  SpeechToTextChunkResponseModel,
  SpeechToTextWebhookResponseModel,
  SpeechToTextWordResponseModel,
} from '@elevenlabs/elevenlabs-js/api/types';
import {
  AIProvider,
  TranscriptionInput,
  TranscriptionOutput,
  TranscriptionProviderError,
} from '@app/protocols/transcription/providers/ai-provider';
import { TranscriptionErrorCode } from '@app/domain/transcription/services/transcription-domain.service';
import {
  HttpClient,
  HttpClientError,
} from '@app/infrastructure/http/http-client';
import {
  canonicalSegmentsToSrt,
  segmentsFromElevenLabsSegmentedJson,
} from '@app/domain/transcription/services/canonical-transcription-responses';

export class ElevenLabsProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionOutput> {
    const key = this.apiKey?.trim();
    if (!key) {
      throw new TranscriptionProviderError(
        'Chave da API ElevenLabs (xi-api-key) não configurada',
        'VALIDATION_ERROR',
      );
    }

    try {
      const buffer =
        input.fileBuffer ?? (await this.downloadFile(input.fileUrl));
      const filename = this.safeFileName(input.fileName, input.fileUrl);
      const modelId = (input.modelName?.trim() ||
        'scribe_v2') as SpeechToTextConvertRequestModelId;

      const client = new ElevenLabsClient({ apiKey: key });

      const lang = this.normalizeLanguageCode(input.language);
      const result = await client.speechToText.convert({
        modelId,
        file: { data: buffer, filename },
        timestampsGranularity: 'word',
        webhook: false,
        additionalFormats: [{ format: 'segmented_json' }],
        ...(lang ? { languageCode: lang } : {}),
        ...(input.diarize === true
          ? {
              diarize: true,
              ...(typeof input.diarizeSpeakerCount === 'number' &&
              input.diarizeSpeakerCount >= 2 &&
              input.diarizeSpeakerCount <= 32
                ? { numSpeakers: input.diarizeSpeakerCount }
                : {}),
            }
          : {}),
      });

      if (this.isWebhookAck(result)) {
        throw new Error(
          'A API ElevenLabs devolveu confirmação de webhook em vez da transcrição. Garanta webhook=false (padrão síncrono).',
        );
      }

      const chunk = this.toChunk(result);
      const text = chunk.text ?? '';
      const words = chunk.words ?? [];
      const fromSegmented = segmentsFromElevenLabsSegmentedJson(result);
      const srtContent =
        fromSegmented && fromSegmented.length > 0
          ? canonicalSegmentsToSrt(fromSegmented)
          : this.wordsToSrt(words, text);

      return {
        text,
        srtContent,
        tokensUsed: Math.ceil(text.length / 4),
        rawResponse: JSON.parse(JSON.stringify(result)),
      };
    } catch (err) {
      throw new TranscriptionProviderError(
        this.formatClientError(err),
        this.mapErrorCode(err),
      );
    }
  }

  private isWebhookAck(
    value: unknown,
  ): value is SpeechToTextWebhookResponseModel {
    if (!value || typeof value !== 'object') return false;
    const o = value as Record<string, unknown>;
    const requestId =
      typeof o.requestId === 'string'
        ? o.requestId
        : typeof o.request_id === 'string'
          ? o.request_id
          : null;
    if (typeof o.message !== 'string' || !requestId) return false;
    return o.text === undefined && !Array.isArray(o.words);
  }

  private isMultichannel(
    value: unknown,
  ): value is MultichannelSpeechToTextResponseModel {
    return (
      !!value &&
      typeof value === 'object' &&
      'transcripts' in value &&
      Array.isArray(
        (value as MultichannelSpeechToTextResponseModel).transcripts,
      ) &&
      (value as MultichannelSpeechToTextResponseModel).transcripts.length > 0
    );
  }

  private toChunk(value: unknown): SpeechToTextChunkResponseModel {
    if (this.isMultichannel(value)) {
      return value.transcripts[0];
    }
    return value as SpeechToTextChunkResponseModel;
  }

  private normalizeLanguageCode(code?: string): string | null {
    if (!code?.trim()) return null;
    const c = code.trim();
    const two = c.split(/[-_]/)[0]?.toLowerCase();
    return two && two.length >= 2 ? two : null;
  }

  private safeFileName(fileName?: string, fileUrl?: string): string {
    const fromName = fileName?.trim();
    if (fromName && !fromName.includes('..') && fromName.length < 240) {
      return fromName;
    }
    try {
      const u = new URL(fileUrl ?? '');
      const base = u.pathname.split('/').pop();
      if (base && base.length < 240) return base;
    } catch {
      void 0;
    }
    return 'audio.mp3';
  }

  private formatClientError(err: unknown): string {
    if (err instanceof ElevenLabsError) {
      const b = err.body;
      if (typeof b === 'object' && b !== null) {
        const rec = b as Record<string, unknown>;
        const d = rec.detail;
        if (typeof d === 'string') return d;
        if (Array.isArray(d) || (typeof d === 'object' && d !== null)) {
          return JSON.stringify(d);
        }
      }
      return err.message;
    }
    return err instanceof Error ? err.message : 'Erro ElevenLabs STT';
  }

  private async downloadFile(url: string): Promise<Buffer> {
    try {
      const res = await HttpClient.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(res.data);
    } catch (e) {
      const err = e as HttpClientError;
      const status = err.status;
      if (status === 401 || status === 403) {
        throw new TranscriptionProviderError(
          'Sem permissão para acessar o arquivo',
          'VALIDATION_ERROR',
        );
      }
      if (status === 404) {
        throw new TranscriptionProviderError(
          'Arquivo não encontrado',
          'INVALID_AUDIO',
        );
      }
      throw new TranscriptionProviderError(
        `Falha ao baixar arquivo (HTTP ${status})`,
        'PROVIDER_UNAVAILABLE',
      );
    }
  }

  private wordsToSrt(
    words: SpeechToTextWordResponseModel[],
    fallbackText: string,
  ): string {
    const timed = words.filter(
      (w) =>
        w.type !== 'spacing' &&
        typeof w.start === 'number' &&
        typeof w.end === 'number' &&
        w.text != null &&
        String(w.text).trim() !== '',
    );
    if (timed.length === 0) {
      return fallbackText.trim()
        ? `1\n00:00:00,000 --> 00:00:05,000\n${fallbackText.trim()}\n`
        : '';
    }

    const segmentDuration = 5;
    const segments: Array<{ start: number; end: number; text: string }> = [];
    let current: { start: number; end: number; text: string[] } | null = null;

    for (const w of timed) {
      const start = w.start as number;
      const end = w.end as number;
      const piece = String(w.text).trim();

      if (!current || start - current.start >= segmentDuration) {
        current = { start, end, text: [piece] };
        segments.push({
          start: current.start,
          end: current.end,
          text: current.text.join(' '),
        });
      } else {
        current.end = end;
        current.text.push(piece);
        segments[segments.length - 1] = {
          start: current.start,
          end: current.end,
          text: current.text.join(' '),
        };
      }
    }

    return segments
      .map((seg, i) => {
        const start = this.formatSrtTime(seg.start);
        const end = this.formatSrtTime(seg.end);
        return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
      })
      .join('\n');
  }

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private mapErrorCode(err: unknown): TranscriptionErrorCode {
    if (err instanceof ElevenLabsError) {
      const code = err.statusCode;
      if (code === 401 || code === 403) return 'VALIDATION_ERROR';
      if (code === 429) return 'RATE_LIMIT';
    }
    const message = err instanceof Error ? err.message : String(err);
    if (
      /401|403|chave|api-key|xi-api-key|Unauthorized|Forbidden/i.test(message)
    ) {
      return 'VALIDATION_ERROR';
    }
    if (/429|rate|quota/i.test(message)) return 'RATE_LIMIT';
    return 'UNKNOWN';
  }
}
