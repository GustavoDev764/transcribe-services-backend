import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
}
