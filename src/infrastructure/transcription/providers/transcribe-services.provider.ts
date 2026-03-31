import {
  AIProvider,
  ExternalTranscriptionStartOutput,
  ExternalTranscriptionStatusOutput,
  TranscriptionInput,
  TranscriptionOutput,
  TranscriptionProviderError,
} from '@app/protocols/transcription/providers/ai-provider';
import {
  HttpClient,
  HttpClientError,
} from '@app/infrastructure/http/http-client';

const POLL_MS = 2000;
const MAX_POLL_ATTEMPTS = 5400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TranscribeServicesProvider implements AIProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly bearerToken: string,
  ) {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.bearerToken.trim()) {
      h.Authorization = `Bearer ${this.bearerToken.trim()}`;
    }
    return h;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionOutput> {
    const started = await this.startExternalJob(input);
    const externalJobId = started.jobId;

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const job = await this.fetchExternalJobStatus(externalJobId);
      if (job.status === 'failed') {
        throw new TranscriptionProviderError(
          job.errorMessage || 'Transcrição falhou no serviço externo',
          'UNKNOWN',
        );
      }
      if (job.status === 'completed') {
        return {
          text: job.text ?? '',
          srtContent: job.srtContent ?? this.singleSegmentSrt(job.text ?? ''),
          rawResponse: job.rawResponse,
        };
      }

      await sleep(POLL_MS);
    }

    throw new TranscriptionProviderError(
      'Timeout aguardando transcrição externa',
      'TIMEOUT',
    );
  }

  async startExternalJob(
    input: TranscriptionInput,
  ): Promise<ExternalTranscriptionStartOutput> {
    const buffer = input.fileBuffer ?? (await this.downloadFile(input.fileUrl));
    const fileName = input.fileName || 'audio.mp3';
    const model = input.modelName || 'small';

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), fileName);
    form.append('model', model);

    try {
      const uploadRes = await HttpClient.post<{
        job_id?: string;
        status?: string;
      }>(this.url('/upload'), {
        data: form,
        headers: this.headers(),
      });
      const payload = uploadRes.data;
      if (!payload.job_id) {
        throw new TranscriptionProviderError(
          'job_id ausente na resposta do upload',
          'VALIDATION_ERROR',
        );
      }

      const st = (payload.status || 'processing').toLowerCase();
      return {
        jobId: payload.job_id,
        status: st === 'queued' ? 'queued' : 'processing',
        rawResponse: payload,
      };
    } catch (e) {
      if (e instanceof TranscriptionProviderError) throw e;
      const err = e as HttpClientError;
      const status = err.status;
      const text =
        typeof err.data === 'string'
          ? err.data
          : JSON.stringify(err.data ?? '');
      throw new TranscriptionProviderError(
        `Upload Transcribe Services falhou (${status ?? 'sem status'}): ${text.slice(0, 500)}`,
        status && status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'VALIDATION_ERROR',
      );
    }
  }

  async fetchExternalJobStatus(
    externalJobId: string,
  ): Promise<ExternalTranscriptionStatusOutput> {
    try {
      const jobRes = await HttpClient.get<{
        status?: string;
        text_content?: string;
        segments?: Array<{ start: number; end: number; text: string }>;
        language?: string;
        error_message?: string | null;
      }>(this.url(`/job/${externalJobId}`), {
        headers: this.headers(),
      });
      const job = jobRes.data;
      const st = (job.status || '').toLowerCase();
      if (st === 'failed' || st === 'error') {
        return {
          status: 'failed',
          rawResponse: JSON.parse(JSON.stringify(job)),
          errorMessage: job.error_message || null,
        };
      }
      if (st === 'completed' || st === 'done') {
        const text = job.text_content ?? '';
        const segments = job.segments ?? [];
        return {
          status: 'completed',
          text,
          srtContent: segments.length
            ? this.segmentsToSrt(segments)
            : this.singleSegmentSrt(text),
          language: job.language,
          rawResponse: JSON.parse(JSON.stringify(job)),
        };
      }
      if (st === 'queued' || st === 'pending') {
        return {
          status: 'queued',
          rawResponse: JSON.parse(JSON.stringify(job)),
        };
      }
      return {
        status: 'processing',
        rawResponse: JSON.parse(JSON.stringify(job)),
      };
    } catch (e) {
      if (e instanceof TranscriptionProviderError) throw e;
      const err = e as HttpClientError;
      const status = err.status;
      const text =
        typeof err.data === 'string'
          ? err.data
          : JSON.stringify(err.data ?? '');
      throw new TranscriptionProviderError(
        `Consulta job falhou (${status ?? 'sem status'}): ${text.slice(0, 500)}`,
        status && status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'VALIDATION_ERROR',
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
}
