import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FileService } from '@app/data/file/use-cases/file.service';
import { GetFileBufferUseCase } from '@app/data/file/use-cases/get-file-buffer.usecase';
import { FileController } from '@app/presentation/file/controllers/file.controller';
import { AuthModule } from '@app/main/modules/auth.module';
import { FileConvertProcessor } from '@app/infrastructure/file/processors/file-convert.processor';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'file-convert',
    }),
    BullModule.registerQueue({
      name: 'transcription',
    }),
  ],
  controllers: [FileController],
  providers: [FileService, FileConvertProcessor, GetFileBufferUseCase],
  exports: [FileService, GetFileBufferUseCase],
})
export class FileModule {}
