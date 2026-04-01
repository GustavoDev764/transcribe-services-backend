import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/presentation/auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'vidwave-backend',
      message: 'API em execução.',
      timestamp: new Date().toISOString(),
    };
  }
}
