import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{6})$/, {
    message: 'A cor deve estar no formato hexadecimal, ex: #60A5FA',
  })
  color?: string;
}
