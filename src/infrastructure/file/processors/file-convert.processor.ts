import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FileService } from '@app/data/file/use-cases/file.service';

@Processor('file-convert', { concurrency: 2 })
export class FileConvertProcessor extends WorkerHost {
  constructor(private readonly fileService: FileService) {
    super();
  }

  async process(job: Job<{ fileId: string; enqueueTranscription?: boolean }>) {
    const { fileId, enqueueTranscription } = job.data;
    await this.fileService.convertStorageFileToMp3(fileId);
    await this.fileService.updateDurationFromStorage(fileId);
    if (!enqueueTranscription) return;
  }
}
