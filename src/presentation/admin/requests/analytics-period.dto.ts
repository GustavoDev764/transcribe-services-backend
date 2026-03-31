import { IsIn, IsOptional } from 'class-validator';

export const ANALYTICS_PERIODS = [
  'hour',
  'day',
  'week',
  'month',
  'year',
] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export class AnalyticsPeriodQueryDto {
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod = 'month';
}
