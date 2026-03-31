import { IsString, IsOptional, IsNotEmpty, IsArray } from 'class-validator';

export class TranslateSegmentsRequestDto {
  @IsArray()
  @IsString({ each: true })
  texts: string[];

  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;
}
