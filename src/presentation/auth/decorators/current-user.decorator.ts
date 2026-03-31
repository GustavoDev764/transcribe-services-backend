import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '@app/domain/auth/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (data: keyof UserEntity | undefined, ctx: ExecutionContext): UserEntity | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserEntity;
    return data ? user?.[data] : user;
  },
);
