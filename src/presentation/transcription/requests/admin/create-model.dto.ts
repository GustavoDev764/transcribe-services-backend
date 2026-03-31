import { IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { AiModelType } from '@prisma/client';

export class CreateModelDto {
  @IsNotEmpty()
  providerId: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  modelName: string;

  @IsOptional()
  @IsEnum(['TRANSCRIPTION'])
  type?: AiModelType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
