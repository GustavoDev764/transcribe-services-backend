import { Module } from '@nestjs/common';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_CONFIG } from '@app/config';
import type { IEnvConfig } from '@app/config/env.interface';
import { AuthService } from '@app/data/auth/use-cases/auth.service';
import { AuthController } from '@app/presentation/auth/controllers/auth.controller';
import { UserRepository } from '@app/infrastructure/auth/repositories/user.repository';
import { JwtStrategy } from '@app/infrastructure/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@app/presentation/auth/guards/permission.guard';
import { ManagerGuard } from '@app/presentation/auth/guards/manager.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: IEnvConfig) =>
        ({
          secret: config.JWT_SECRET,
          signOptions: { expiresIn: config.JWT_EXPIRES_IN },
        }) as JwtModuleOptions,
      inject: [APP_CONFIG],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, JwtStrategy, JwtAuthGuard, PermissionGuard, ManagerGuard],
  exports: [AuthService, UserRepository, JwtAuthGuard, PermissionGuard, ManagerGuard],
})
export class AuthModule {}
