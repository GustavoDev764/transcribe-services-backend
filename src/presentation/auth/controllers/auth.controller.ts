import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '@app/data/auth/use-cases/auth.service';
import { CreateAccountDto } from '@app/presentation/auth/requests/create-account.dto';
import { LoginDto } from '@app/presentation/auth/requests/login.dto';
import { Public } from '@app/presentation/auth/decorators/public.decorator';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { ManagerGuard } from '@app/presentation/auth/guards/manager.guard';
import { CurrentUser } from '@app/presentation/auth/decorators/current-user.decorator';
import { UserEntity } from '@app/domain/auth/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: CreateAccountDto) {
    return this.authService.createAccount(dto, 'CLIENT');
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('manager/register')
  @UseGuards(JwtAuthGuard, ManagerGuard)
  async managerRegister(@Body() dto: CreateAccountDto) {
    return this.authService.createAccount(dto, 'MANAGER');
  }

  @Public()
  @Post('manager/login')
  async managerLogin(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    if (result.user.profile !== 'MANAGER') {
      throw new ForbiddenException('Acesso restrito a administradores');
    }
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  me(@CurrentUser() user: UserEntity) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      profile: user.profile,
      permissions: user.permissions,
    };
  }
}
