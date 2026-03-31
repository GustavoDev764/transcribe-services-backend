import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { UserProfile } from '@prisma/client';
import { UserEntity } from '@app/domain/auth/entities/user.entity';
import { PROFILE_PERMISSIONS } from '@app/domain/constants/permissions.constants';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? this.toEntity(user) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.db.user.findUnique({
      where: { id },
    });
    return user ? this.toEntity(user) : null;
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
    profile?: UserProfile;
  }): Promise<UserEntity> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const permissions =
      PROFILE_PERMISSIONS[data.profile || 'CLIENT'] || PROFILE_PERMISSIONS.CLIENT;

    const user = await this.db.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        profile: data.profile || 'CLIENT',
        permissions,
      },
    });
    return this.toEntity(user);
  }

  async validatePassword(user: UserEntity, password: string): Promise<boolean> {
    const dbUser = await this.db.user.findUnique({
      where: { id: user.id },
    });
    return dbUser ? bcrypt.compare(password, dbUser.passwordHash) : false;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      profile: UserProfile;
      permissions: string[];
      isActive: boolean;
    }>,
  ): Promise<UserEntity> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.profile !== undefined) {
      updateData.profile = data.profile;
      updateData.permissions =
        PROFILE_PERMISSIONS[data.profile] || PROFILE_PERMISSIONS.CLIENT;
    }
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const user = await this.db.user.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(user);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async findMany(options: {
    page?: number;
    limit?: number;
    profile?: UserProfile;
    isActive?: boolean;
  }): Promise<{ users: UserEntity[]; total: number }> {
    const { page = 1, limit = 10, profile, isActive } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (profile !== undefined) where.profile = profile;
    if (isActive !== undefined) where.isActive = isActive;

    const [users, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count({ where }),
    ]);

    return {
      users: users.map((u) => this.toEntity(u)),
      total,
    };
  }

  private toEntity(user: {
    id: string;
    email: string;
    name: string;
    profile: UserProfile;
    permissions: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return new UserEntity({
      id: user.id,
      email: user.email,
      name: user.name,
      profile: user.profile,
      permissions: user.permissions,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
