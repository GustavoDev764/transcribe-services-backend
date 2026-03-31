import { Module } from '@nestjs/common';
import { EmailTemplateService } from '@app/data/email-template/use-cases/email-template.service';
import { EmailTemplateController } from '@app/presentation/email-template/controllers/email-template.controller';
import { AuthModule } from '@app/main/modules/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EmailTemplateController],
  providers: [EmailTemplateService],
  exports: [EmailTemplateService],
})
export class EmailTemplateModule {}
