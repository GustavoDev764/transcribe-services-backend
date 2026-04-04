import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';

export class CreateProviderDto {
  @IsEnum(ProviderName)
  name: ProviderName;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
