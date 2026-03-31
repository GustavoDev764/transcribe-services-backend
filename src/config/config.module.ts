import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, getConfigEnv } from '@app/config/env.config';
import type { IEnvConfig } from '@app/config/env.interface';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory(): IEnvConfig {
        return getConfigEnv();
      },
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigEnvModule {}
