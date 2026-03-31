import { UserProfile } from '@prisma/client';

export class UserEntity {
  id: string;
  email: string;
  name: string;
  profile: UserProfile;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  isManager(): boolean {
    return this.profile === 'MANAGER';
  }
}
