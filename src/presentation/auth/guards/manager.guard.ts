import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { UserEntity } from '@app/domain/auth/entities/user.entity';

@Injectable()
export class ManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: UserEntity }>();
    if (!user || !user.isManager()) {
      throw new ForbiddenException('Acesso restrito a administradores');
    }
    return true;
  }
}
