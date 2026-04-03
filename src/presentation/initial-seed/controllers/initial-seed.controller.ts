import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InitialSeedService } from '@app/data/initial-seed/initial-seed.service';
import { Public } from '@app/presentation/auth/decorators/public.decorator';
import { InitialSeedSecretGuard } from '@app/presentation/auth/guards/initial-seed-secret.guard';
import { RunInitialSeedDto } from '@app/presentation/initial-seed/requests/run-initial-seed.dto';

@Controller('internal/initial-seed')
@Public()
@UseGuards(InitialSeedSecretGuard)
export class InitialSeedController {
  constructor(private readonly initialSeedService: InitialSeedService) {}

  @Get('status')
  async status() {
    return this.initialSeedService.getStatus();
  }

  @Post()
  async run(@Body() body: RunInitialSeedDto) {
    const result = await this.initialSeedService.executeOnce({
      managerEmail: body.managerEmail,
      managerPassword: body.managerPassword,
    });
    return {
      message: 'Seed inicial concluído',
      completedAt: result.completedAt,
    };
  }
}
