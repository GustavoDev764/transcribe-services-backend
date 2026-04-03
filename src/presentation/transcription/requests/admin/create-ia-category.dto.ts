import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IaCategoryKind } from '@prisma/client';
import { parseIaCategoryTipoInput } from '@app/presentation/transcription/requests/admin/ia-category-tipo.parse';

export class CreateIaCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @Transform(({ value }) => parseIaCategoryTipoInput(value))
  @IsEnum(IaCategoryKind)
  tipo?: IaCategoryKind;
}
