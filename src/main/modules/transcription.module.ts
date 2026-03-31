import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@app/main/modules/auth.module';
import { TranscriptionController } from '@app/presentation/transcription/controllers/transcription.controller';
import { TranscriptionAdminController } from '@app/presentation/transcription/controllers/transcription-admin.controller';
import { CreateTranscriptionUseCase } from '@app/data/transcription/use-cases/create-transcription.usecase';
import { ProcessTranscriptionUseCase } from '@app/data/transcription/use-cases/process-transcription.usecase';
import { SyncTranscriptionStatusUseCase } from '@app/data/transcription/use-cases/sync-transcription-status.usecase';
import { TranscriptionAdminService } from '@app/data/transcription/use-cases/transcription-admin.service';
import { TranscriptionDomainService } from '@app/domain/transcription/services/transcription-domain.service';
import { ProviderFactory } from '@app/infrastructure/transcription/providers/provider.factory';
import { TranscriptionProcessor } from '@app/infrastructure/transcription/queue/transcription.processor';
import { PrismaTranscriptionJobRepository } from '@app/infrastructure/transcription/prisma/prisma-transcription-job.repository';
import { PrismaAiModelRepository } from '@app/infrastructure/transcription/prisma/prisma-ai-model.repository';
import { PrismaProviderCredentialRepository } from '@app/infrastructure/transcription/prisma/prisma-provider-credential.repository';
import { PrismaUsageLogRepository } from '@app/infrastructure/transcription/prisma/prisma-usage-log.repository';
import { PrismaProviderAdminRepository } from '@app/infrastructure/transcription/prisma/prisma-provider-admin.repository';
import { PrismaProviderCredentialAdminRepository } from '@app/infrastructure/transcription/prisma/prisma-provider-credential-admin.repository';
import { PrismaAiModelAdminRepository } from '@app/infrastructure/transcription/prisma/prisma-ai-model-admin.repository';
import { TRANSCRIPTION_TOKENS } from '@app/domain/transcription/constants/transcription.tokens';
import {
  TRANSCRIPTION_ADMIN_TOKENS,
} from '@app/data/transcription/use-cases/transcription-admin.service';
import { FileModule } from '@app/main/modules/file.module';

@Module({
  imports: [
    AuthModule,
    FileModule,
    BullModule.registerQueue({
      name: 'transcription',
    }),
  ],
  controllers: [TranscriptionController, TranscriptionAdminController],
  providers: [
    CreateTranscriptionUseCase,
    ProcessTranscriptionUseCase,
    SyncTranscriptionStatusUseCase,
    TranscriptionAdminService,
    TranscriptionDomainService,
    ProviderFactory,
    TranscriptionProcessor,
    { provide: TRANSCRIPTION_TOKENS.JobRepository, useClass: PrismaTranscriptionJobRepository },
    { provide: TRANSCRIPTION_TOKENS.ModelRepository, useClass: PrismaAiModelRepository },
    { provide: TRANSCRIPTION_TOKENS.CredentialRepository, useClass: PrismaProviderCredentialRepository },
    { provide: TRANSCRIPTION_TOKENS.UsageLogRepository, useClass: PrismaUsageLogRepository },
    { provide: TRANSCRIPTION_ADMIN_TOKENS.ProviderRepository, useClass: PrismaProviderAdminRepository },
    { provide: TRANSCRIPTION_ADMIN_TOKENS.ProviderCredentialRepository, useClass: PrismaProviderCredentialAdminRepository },
    { provide: TRANSCRIPTION_ADMIN_TOKENS.AiModelRepository, useClass: PrismaAiModelAdminRepository },
  ],
  exports: [],
})
export class TranscriptionModule {}
