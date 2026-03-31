import speech from '@google-cloud/speech';
import { AIProvider, TranscriptionInput, TranscriptionOutput, TranscriptionProviderError } from '@app/protocols/transcription/providers/ai-provider';
import { TranscriptionErrorCode } from '@app/domain/transcription/services/transcription-domain.service';
import { HttpClient, HttpClientError } from '@app/infrastructure/http/http-client';

export class GoogleProvider implements AIProvider {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionOutput> {
    try {
      const client = new speech.SpeechClient();
      const buffer = input.fileBuffer ?? await this.downloadFile(input.fileUrl);
      const audio = {
        content: buffer.toString('base64'),
      };

      const config: any = {
        encoding: 'MP3',
        sampleRateHertz: 16000,
        languageCode: input.language || 'pt-BR',
        model: input.modelName || 'default',
        enableWordTimeOffsets: true,
      };

      const [response] = await client.recognize({ audio, config });
      const transcription = response.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .join('\n') || '';

      const words: Array<{ word: string; start: number; end: number }> = [];
      for (const result of response.results || []) {
        const alternative = result.alternatives?.[0];
        if (!alternative?.words) continue;
        for (const word of alternative.words) {
          const start = Number(word.startTime?.seconds || 0) + Number(word.startTime?.nanos || 0) / 1e9;
          const end = Number(word.endTime?.seconds || 0) + Number(word.endTime?.nanos || 0) / 1e9;
          words.push({ word: word.word || '', start, end });
        }
      }

      const srtContent = this.wordsToSrtSegments(words);
      return {
        text: transcription,
        srtContent,
        tokensUsed: Math.ceil(transcription.length / 4),
        rawResponse: JSON.parse(JSON.stringify(response)),
      };
    } catch (err) {
      throw new TranscriptionProviderError(
        err instanceof Error ? err.message : 'Erro Google Speech',
        this.mapErrorCode(err),
      );
    }
  }

  private async downloadFile(url: string): Promise<Buffer> {
    try {
      const res = await HttpClient.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
      return Buffer.from(res.data);
    } catch (e) {
      const err = e as HttpClientError;
      const status = err.status;
      if (status === 401 || status === 403) {
        throw new TranscriptionProviderError('Sem permissão para acessar o arquivo', 'VALIDATION_ERROR');
      }
      if (status === 404) {
        throw new TranscriptionProviderError('Arquivo não encontrado', 'INVALID_AUDIO');
      }
      throw new TranscriptionProviderError(`Falha ao baixar arquivo (HTTP ${status})`, 'PROVIDER_UNAVAILABLE');
    }
  }

  private wordsToSrtSegments(words: Array<{ word: string; start: number; end: number }>): string {
    const segmentDuration = 5;
    const segments: Array<{ start: number; end: number; text: string }> = [];
    let current: { start: number; end: number; text: string[] } | null = null;

    for (const w of words) {
      if (!current || w.start - current.start >= segmentDuration) {
        current = { start: w.start, end: w.end, text: [w.word] };
        segments.push({
          start: current.start,
          end: current.end,
          text: current.text.join(' '),
        });
      } else {
        current.end = w.end;
        current.text.push(w.word);
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
    const message = (err as any)?.message || '';
    if (message.includes('PERMISSION_DENIED')) return 'VALIDATION_ERROR';
    if (message.includes('RESOURCE_EXHAUSTED')) return 'RATE_LIMIT';
    return 'UNKNOWN';
  }
}
