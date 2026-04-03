import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AiModelType } from '@prisma/client';

export class CreateModelDto {
  @IsNotEmpty()
  providerId: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  categoryId?: string | null;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  modelName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32768)
  subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32768)
  textTooltip?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  urlIcone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  iconFileName?: string | null;

  @IsOptional()
  @IsEnum(['TRANSCRIPTION'])
  type?: AiModelType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
