import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { SystemConfigService } from '@app/data/system-config/use-cases/system-config.service';
import { SetConfigDto } from '@app/presentation/system-config/requests/set-config.dto';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { ManagerGuard } from '@app/presentation/auth/guards/manager.guard';

@Controller('admin/system-config')
@UseGuards(JwtAuthGuard, ManagerGuard)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get(':key')
  async getConfig(@Param('key') key: string) {
    const value = await this.systemConfigService.getConfig(key);
    return { key, value };
  }

  @Put(':key')
  async setConfig(
    @Param('key') key: string,
    @Body() dto: SetConfigDto,
  ) {
    await this.systemConfigService.setConfig(key, dto.value);
    return { key, message: 'Configuração atualizada' };
  }
}
