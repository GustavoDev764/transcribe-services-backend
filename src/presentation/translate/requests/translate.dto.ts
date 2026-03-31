import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class TranslateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text: string;

  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;
}
