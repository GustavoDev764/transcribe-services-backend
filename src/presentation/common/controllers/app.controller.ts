import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/presentation/auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return {
      status: 'ok',
      message: 'API em execução.',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
