import { IsEnum, IsOptional } from 'class-validator';
import { TranscriptionMode } from '@prisma/client';

export class UploadFileDto {
  @IsOptional()
  @IsEnum(['CHITA', 'GOLFINHO', 'BALEIA'])
  mode?: TranscriptionMode;
}
