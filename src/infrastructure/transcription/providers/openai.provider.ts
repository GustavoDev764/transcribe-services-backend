import OpenAI from 'openai';
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

export class OpenAIProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  private openAiLanguageHint(code?: string): string | undefined {
    const t = code?.trim();
    if (!t) return undefined;
    const two = t.split(/[-_]/)[0]?.toLowerCase();
    return two && two.length >= 2 ? two : undefined;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionOutput> {
    if (input.diarize) {
      return this.transcribeDiarized(input);
    }

    const openai = new OpenAI({ apiKey: this.apiKey });
    const buffer = input.fileBuffer ?? (await this.downloadFile(input.fileUrl));
    const fileInstance = this.buildFile(
      buffer,
      input.fileName || input.fileUrl,
    );

    try {
      const responseFormat = input.modelName.startsWith('gpt-4o')
        ? 'json'
        : 'verbose_json';
      const lang = this.openAiLanguageHint(input.language);
      const response = await openai.audio.transcriptions.create({
        file: fileInstance,
        model: input.modelName,
        response_format: responseFormat,
        ...(responseFormat === 'verbose_json'
          ? { timestamp_granularities: ['segment'] }
          : {}),
        ...(lang ? { language: lang } : {}),
      });

      const payload = response as {
        text?: string;
        segments?: Array<{ start: number; end: number; text: string }>;
      };
      const text = payload.text ?? '';
      const segments = payload.segments ?? [];
      const srtContent = segments.length
        ? this.segmentsToSrt(segments)
        : this.singleSegmentSrt(text);

      return {
        text,
        srtContent,
        tokensUsed: this.estimateTokens(text),
        rawResponse: JSON.parse(JSON.stringify(response)),
      };
    } catch (err) {
      throw new TranscriptionProviderError(
        err instanceof Error ? err.message : 'Erro OpenAI',
        this.mapErrorCode(err),
      );
    }
  }

  private async transcribeDiarized(
    input: TranscriptionInput,
  ): Promise<TranscriptionOutput> {
    const openai = new OpenAI({ apiKey: this.apiKey });
    const buffer = input.fileBuffer ?? (await this.downloadFile(input.fileUrl));
    const fileInstance = this.buildFile(
      buffer,
      input.fileName || input.fileUrl,
    );

    try {
      const langD = this.openAiLanguageHint(input.language);
      const response = await openai.audio.transcriptions.create({
        file: fileInstance,
        model: input.modelName,
        response_format: 'diarized_json',
        chunking_strategy: 'auto',
        ...(langD ? { language: langD } : {}),
      });

      const payload = response as {
        text?: string;
        segments?: Array<{
          start: number;
          end: number;
          text: string;
          speaker: string;
        }>;
      };
      const segments = payload.segments ?? [];
      const text =
        payload.text?.trim() ||
        segments.map((s) => `${s.speaker}: ${s.text.trim()}`).join('\n');
      const srtContent = segments.length
        ? this.diarizedSegmentsToSrt(segments)
        : this.singleSegmentSrt(text);

      const rawResponse = JSON.parse(JSON.stringify(response)) as Record<
        string,
        unknown
      >;
      rawResponse.client_requested_speaker_count =
        input.diarizeSpeakerCount ?? null;

      return {
        text,
        srtContent,
        tokensUsed: this.estimateTokens(text),
        rawResponse,
      };
    } catch (err) {
      throw new TranscriptionProviderError(
        err instanceof Error ? err.message : 'Erro OpenAI',
        this.mapErrorCode(err),
      );
    }
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

  private buildFile(buffer: Buffer, fileName: string) {
    const name = fileName.split('/').pop() || 'audio.mp3';
    const blob = new Blob([new Uint8Array(buffer)]);
    return new File([blob], name);
  }

  private segmentsToSrt(
    segments: Array<{ start: number; end: number; text: string }>,
  ) {
    return segments
      .map((seg, i) => {
        const start = this.formatSrtTime(seg.start);
        const end = this.formatSrtTime(seg.end);
        return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
      })
      .join('\n');
  }

  private diarizedSegmentsToSrt(
    segments: Array<{
      start: number;
      end: number;
      text: string;
      speaker: string;
    }>,
  ) {
    return segments
      .map((seg, i) => {
        const start = this.formatSrtTime(seg.start);
        const end = this.formatSrtTime(seg.end);
        const label = (seg.speaker || '?').trim();
        return `${i + 1}\n${start} --> ${end}\n${label}: ${seg.text.trim()}\n`;
      })
      .join('\n');
  }

  private singleSegmentSrt(text: string) {
    if (!text) return '';
    return `1\n00:00:00,000 --> 00:00:10,000\n${text.trim()}\n`;
  }

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private mapErrorCode(err: unknown): TranscriptionErrorCode {
    const status =
      err !== null &&
      typeof err === 'object' &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : undefined;
    if (status === 400) return 'VALIDATION_ERROR';
    if (status === 408) return 'TIMEOUT';
    if (status === 429) return 'RATE_LIMIT';
    if (status === 502 || status === 503 || status === 504) {
      return 'PROVIDER_UNAVAILABLE';
    }
    return 'UNKNOWN';
  }
}
