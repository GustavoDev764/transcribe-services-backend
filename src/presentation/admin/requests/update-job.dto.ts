import { Allow, IsEnum, IsOptional, IsString } from 'class-validator';
import { TranscriptionStatus } from '@prisma/client';

export class UpdateJobDto {
  @IsOptional()
  @IsEnum(TranscriptionStatus)
  status?: TranscriptionStatus;

  @IsOptional()
  @Allow()
  responses?: unknown;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;
}
