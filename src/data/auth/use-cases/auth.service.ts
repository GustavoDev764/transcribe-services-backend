import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '@app/infrastructure/auth/repositories/user.repository';
import { CreateAccountDto } from '@app/presentation/auth/requests/create-account.dto';
import { LoginDto } from '@app/presentation/auth/requests/login.dto';
import { UserEntity } from '@app/domain/auth/entities/user.entity';
import { UserProfile } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  profile: UserProfile;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    profile: UserProfile;
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async createAccount(dto: CreateAccountDto, profile: UserProfile = 'CLIENT'): Promise<AuthResponse> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    const user = await this.userRepository.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      profile,
    });

    return this.generateAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    const valid = await this.userRepository.validatePassword(user, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateAuthResponse(user);
  }

  async validateUser(payload: JwtPayload): Promise<UserEntity | null> {
    return this.userRepository.findById(payload.sub);
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    await this.userRepository.updatePassword(userId, newPassword);
  }

  private generateAuthResponse(user: UserEntity): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      profile: user.profile,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profile: user.profile,
        permissions: user.permissions,
      },
    };
  }
}
