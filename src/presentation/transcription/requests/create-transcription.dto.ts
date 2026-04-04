import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTranscriptionDto {
  @IsUUID()
  file_id: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  preferred_ai_model_id?: string;

  @IsOptional()
  @IsIn(['tiny', 'base', 'small'])
  transcribe_model?: 'tiny' | 'base' | 'small';

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  recognize_speakers?: boolean;

  @IsOptional()
  @ValidateIf((o: CreateTranscriptionDto) => o.recognize_speakers === true)
  @IsInt()
  @Min(2)
  @Max(32)
  diarize_speaker_count?: number;
}
