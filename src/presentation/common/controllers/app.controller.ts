import { Controller, Get, Next, Req, Res } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { Public } from '@app/presentation/auth/decorators/public.decorator';

const API_PREFIXES = [
  '/auth',
  '/files',
  '/folders',
  '/admin',
  '/ai-integrations',
  '/transcription',
  '/translate',
];

@Controller()
export class AppController {
  @Public()
  @Get()
  root(@Res() res: Response) {
    res.sendFile(
      join(__dirname, '..', '..', '..', '..', 'public', 'index.html'),
    );
  }

  @Public()
  @Get('*')
  serveSpa(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const isApiRoute = API_PREFIXES.some((p) => req.path.startsWith(p));
    if (isApiRoute) {
      return next();
    }
    res.sendFile(
      join(__dirname, '..', '..', '..', '..', 'public', 'index.html'),
    );
  }
}
