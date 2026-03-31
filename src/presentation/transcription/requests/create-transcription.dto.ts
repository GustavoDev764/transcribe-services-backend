import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateTranscriptionDto {
  @IsUUID()
  file_id: string;

  /** Somente com provider ativo TRANSCRIBE_SERVICES; ignorado / erro nos demais. */
  @IsOptional()
  @IsIn(['tiny', 'base', 'small'])
  transcribe_model?: 'tiny' | 'base' | 'small';
}
