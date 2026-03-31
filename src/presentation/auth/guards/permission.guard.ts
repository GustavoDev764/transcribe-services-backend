import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserEntity } from '@app/domain/auth/entities/user.entity';
import { PERMISSIONS_KEY } from '@app/presentation/auth/decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: UserEntity }>();
    if (!user) return false;

    const hasAll = requiredPermissions.every((p) => user.hasPermission(p));
    if (!hasAll) {
      throw new ForbiddenException('Sem permissão para esta ação');
    }
    return true;
  }
}
