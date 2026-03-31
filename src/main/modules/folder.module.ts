import { Module } from '@nestjs/common';
import { FolderService } from '@app/data/folder/use-cases/folder.service';
import { FolderController } from '@app/presentation/folder/controllers/folder.controller';
import { AuthModule } from '@app/main/modules/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
