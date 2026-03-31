import { IsNotEmpty, IsString } from 'class-validator';

export class SetConfigDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}
