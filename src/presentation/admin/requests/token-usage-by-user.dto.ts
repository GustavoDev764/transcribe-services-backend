import { IsIn, IsOptional } from 'class-validator';

export const TOKEN_USAGE_SORT = ['highest', 'lowest', 'average'] as const;
export type TokenUsageSort = (typeof TOKEN_USAGE_SORT)[number];

export class TokenUsageByUserQueryDto {
  @IsOptional()
  @IsIn(TOKEN_USAGE_SORT)
  sort?: TokenUsageSort = 'highest';
}
