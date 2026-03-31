import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from '@app/infrastructure/auth/repositories/user.repository';
import { AuthService } from '@app/data/auth/use-cases/auth.service';
import { CreateUserDto } from '@app/presentation/admin/requests/create-user.dto';
import { UpdateUserDto } from '@app/presentation/admin/requests/update-user.dto';
import { ListUsersQueryDto } from '@app/presentation/admin/requests/list-users.dto';
import { ResetPasswordDto } from '@app/presentation/admin/requests/reset-password.dto';
import { UserProfile } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const isActive =
      query.isActive === undefined ? undefined : query.isActive === 'true';

    const { users, total } = await this.userRepository.findMany({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      profile: query.profile as UserProfile | undefined,
      isActive,
    });

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        profile: u.profile,
        permissions: u.permissions,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totalPages: Math.ceil(total / (query.limit ?? 10)),
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    const result = await this.authService.createAccount(
      {
        email: dto.email,
        password: dto.password,
        name: dto.name,
      },
      (dto.profile as UserProfile) ?? 'CLIENT',
    );

    return {
      ...result.user,
      message: 'Usuário criado com sucesso',
    };
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email já cadastrado');
      }
    }

    const updateData: Parameters<UserRepository['update']>[1] = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.profile !== undefined) updateData.profile = dto.profile;
    if (dto.permissions !== undefined) updateData.permissions = dto.permissions;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.userRepository.update(userId, updateData);

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      profile: updated.profile,
      permissions: updated.permissions,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async disableUser(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.userRepository.update(userId, { isActive: false });

    return {
      message: 'Usuário desabilitado com sucesso',
      userId,
    };
  }

  async resetPassword(userId: string, dto: ResetPasswordDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const newPassword = dto.newPassword ?? this.generateRandomPassword();

    await this.authService.resetPassword(userId, newPassword);

    return {
      message: 'Senha resetada com sucesso',
      userId,
      ...(dto.newPassword ? {} : { generatedPassword: newPassword }),
    };
  }

  private generateRandomPassword(length = 12): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
      const n = bytes[i] ?? 0;
      password += chars[n % chars.length];
    }
    return password;
  }
}
