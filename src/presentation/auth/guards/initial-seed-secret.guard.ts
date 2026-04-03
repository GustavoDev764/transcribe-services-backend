import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_CONFIG } from '@app/config/env.config';
import type { IEnvConfig } from '@app/config/env.interface';

@Injectable()
export class InitialSeedSecretGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: IEnvConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.INITIAL_SEED_SECRET;
    if (expected === '') {
      throw new ForbiddenException(
        'Seed inicial via API está desabilitado (INITIAL_SEED_SECRET não configurado).',
      );
    }

    if (this.config.MANAGER_EMAIL.trim() === '') {
      throw new ForbiddenException(
        'Seed inicial via API está desabilitado (MANAGER_EMAIL não configurado).',
      );
    }

    if (this.config.MANAGER_PASSWORD.trim() === '') {
      throw new ForbiddenException(
        'Seed inicial via API está desabilitado (MANAGER_PASSWORD não configurado).',
      );
    }

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers['x-initial-seed-secret'];
    const received =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

    if (received !== expected) {
      throw new UnauthorizedException('Segredo inválido');
    }

    return true;
  }
}
