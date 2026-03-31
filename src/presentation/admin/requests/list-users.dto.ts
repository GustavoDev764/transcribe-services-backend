import { IsBooleanString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserProfileFilter {
  CLIENT = 'CLIENT',
  MANAGER = 'MANAGER',
}

export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(UserProfileFilter)
  profile?: UserProfileFilter;

  @IsOptional()
  @IsBooleanString()
  isActive?: string; // 'true' | 'false'
}
