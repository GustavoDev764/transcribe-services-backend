import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ProviderName } from '@prisma/client';

export class CreateProviderDto {
  @IsEnum(['OPENAI', 'GOOGLE_SPEECH', 'TRANSCRIBE_SERVICES'])
  name: ProviderName;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
