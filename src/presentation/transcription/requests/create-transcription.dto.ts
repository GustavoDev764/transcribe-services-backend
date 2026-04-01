import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateTranscriptionDto {
  @IsUUID()
  file_id: string;

  @IsOptional()
  @IsIn(['tiny', 'base', 'small'])
  transcribe_model?: 'tiny' | 'base' | 'small';
}
