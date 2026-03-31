import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProcessTranscriptionUseCase } from '@app/data/transcription/use-cases/process-transcription.usecase';
import { SyncTranscriptionStatusUseCase } from '@app/data/transcription/use-cases/sync-transcription-status.usecase';

@Processor('transcription', { concurrency: 2 })
export class TranscriptionProcessor extends WorkerHost {
  constructor(
    private readonly useCase: ProcessTranscriptionUseCase,
    private readonly syncUseCase: SyncTranscriptionStatusUseCase,
  ) {
    super();
  }

  async process(job: Job<{ jobId?: string; transcriptionJobId?: string }>) {
    if (job.name === 'sync-status' && job.data.transcriptionJobId) {
      await this.syncUseCase.execute({
        transcriptionJobId: job.data.transcriptionJobId,
      });
      return;
    }
    if (job.data.jobId) {
      await this.useCase.execute({ jobId: job.data.jobId });
    }
  }
}
