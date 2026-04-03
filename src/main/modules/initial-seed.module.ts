import { Module } from '@nestjs/common';
import { InitialSeedService } from '@app/data/initial-seed/initial-seed.service';
import { InitialSeedController } from '@app/presentation/initial-seed/controllers/initial-seed.controller';
import { InitialSeedSecretGuard } from '@app/presentation/auth/guards/initial-seed-secret.guard';

@Module({
  controllers: [InitialSeedController],
  providers: [InitialSeedService, InitialSeedSecretGuard],
})
export class InitialSeedModule {}
