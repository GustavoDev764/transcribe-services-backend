import { Module } from '@nestjs/common';
import { SystemConfigService } from '@app/data/system-config/use-cases/system-config.service';
import { SystemConfigController } from '@app/presentation/system-config/controllers/system-config.controller';
import { AuthModule } from '@app/main/modules/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
