import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RunInitialSeedDto {
  @IsOptional()
  @IsEmail()
  managerEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  managerPassword?: string;
}
