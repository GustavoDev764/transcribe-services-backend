import { Module } from '@nestjs/common';
import { AuthModule } from '@app/main/modules/auth.module';
import { SystemConfigModule } from '@app/main/modules/system-config.module';
import { TranslateService } from '@app/data/translate/translate.service';
import { TranslateController } from '@app/presentation/translate/controllers/translate.controller';

@Module({
  imports: [AuthModule, SystemConfigModule],
  controllers: [TranslateController],
  providers: [TranslateService],
  exports: [TranslateService],
})
export class TranslateModule {}
