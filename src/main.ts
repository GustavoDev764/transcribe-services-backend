import 'dotenv/config';

import { getConfigEnv } from '@app/config';

const configEnv = getConfigEnv();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = configEnv.DATABASE_URL;
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '@app/main/app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.set('etag', false);
  httpAdapter.use(
    (
      _req: unknown,
      res: { setHeader: (k: string, v: string) => void },
      next: () => void,
    ) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      next();
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://unbearing-baric-alda.ngrok-free.dev',
    ],
    credentials: true,
  });
  app.useStaticAssets(join(__dirname, '..', 'public'));
  await app.listen(configEnv.HOST_PORT);
}
void bootstrap();
