import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from '@app/presentation/admin/controllers/admin.controller';
import { AdminUserService } from '@app/data/admin/use-cases/admin-user.service';
import { AdminAnalyticsService } from '@app/data/admin/use-cases/admin-analytics.service';
import { AuthModule } from '@app/main/modules/auth.module';
import { AdminJobService } from '@app/data/admin/use-cases/admin-job.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'transcription',
    }),
  ],
  controllers: [AdminController],
  providers: [AdminUserService, AdminAnalyticsService, AdminJobService],
})
export class AdminModule {}
