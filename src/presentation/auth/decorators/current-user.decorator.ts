import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '@app/domain/auth/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (
    data: keyof UserEntity | undefined,
    ctx: ExecutionContext,
  ): UserEntity | UserEntity[keyof UserEntity] | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: UserEntity }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
