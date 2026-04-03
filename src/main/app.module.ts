import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigEnvModule } from '@app/config';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { DatabaseModule } from '@app/infrastructure/database/database.module';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { AppController } from '@app/presentation/common/controllers/app.controller';
import { AdminModule } from '@app/main/modules/admin.module';
import { AuthModule } from '@app/main/modules/auth.module';
import { EmailTemplateModule } from '@app/main/modules/email-template.module';
import { FileModule } from '@app/main/modules/file.module';
import { FolderModule } from '@app/main/modules/folder.module';
import { InitialSeedModule } from '@app/main/modules/initial-seed.module';
import { SystemConfigModule } from '@app/main/modules/system-config.module';
import { TranscriptionModule } from '@app/main/modules/transcription.module';
import { TranslateModule } from '@app/main/modules/translate.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ConfigEnvModule,
    BullModule.forRootAsync({
      useFactory: (config: IEnvConfig) => {
        const redisCloudUrl = config.REDISCLOUD_URL.trim();
        if (redisCloudUrl !== '') {
          return { connection: { url: redisCloudUrl } };
        }
        return {
          connection: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            db: config.REDIS_DB,
          },
        };
      },
      inject: [APP_CONFIG],
    }),
    DatabaseModule,
    AuthModule,
    FolderModule,
    FileModule,
    TranscriptionModule,
    TranslateModule,
    AdminModule,
    EmailTemplateModule,
    SystemConfigModule,
    InitialSeedModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
