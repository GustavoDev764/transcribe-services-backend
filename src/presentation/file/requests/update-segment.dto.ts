import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateSegmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
