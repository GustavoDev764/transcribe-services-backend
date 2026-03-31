import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { AnalyticsPeriod } from '@app/presentation/admin/requests/analytics-period.dto';
import { TokenUsageSort } from '@app/presentation/admin/requests/token-usage-by-user.dto';

@Injectable()
export class AdminAnalyticsService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  private getDateRange(period: AnalyticsPeriod): {
    currentStart: Date;
    currentEnd: Date;
    previousStart: Date;
    previousEnd: Date;
  } {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case 'hour': {
        currentStart = new Date(now);
        currentStart.setMinutes(0, 0, 0);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        previousStart = new Date(previousEnd);
        previousStart.setHours(previousStart.getHours() - 1);
        break;
      }
      case 'day': {
        currentStart = new Date(now);
        currentStart.setHours(0, 0, 0, 0);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 1);
        break;
      }
      case 'week': {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        currentStart = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 7);
        break;
      }
      case 'month': {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        break;
      }
      case 'year': {
        currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        previousEnd = new Date(currentStart);
        previousEnd.setMilliseconds(-1);
        previousStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        break;
      }
      default: {
        const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        currentStart = d;
        previousEnd = new Date(d);
        previousEnd.setMilliseconds(-1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      }
    }

    const currentEnd = new Date(now);

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
  }

  async getTokenUsageStats(period: AnalyticsPeriod) {
    const { currentStart, currentEnd, previousStart, previousEnd } =
      this.getDateRange(period);

    const [currentResult, previousResult] = await Promise.all([
      this.db.aiUsageLog.aggregate({
        where: {
          createdAt: {
            gte: currentStart,
            lte: currentEnd,
          },
        },
        _sum: { tokens: true },
      }),
      this.db.aiUsageLog.aggregate({
        where: {
          createdAt: {
            gte: previousStart,
            lte: previousEnd,
          },
        },
        _sum: { tokens: true },
      }),
    ]);

    const currentTokens = currentResult._sum.tokens ?? 0;
    const previousTokens = previousResult._sum.tokens ?? 0;

    const percentChange =
      previousTokens > 0
        ? ((currentTokens - previousTokens) / previousTokens) * 100
        : currentTokens > 0
          ? 100
          : 0;

    return {
      period,
      tokensUsed: currentTokens,
      previousPeriodTokens: previousTokens,
      percentChange: Math.round(percentChange * 100) / 100,
      currentPeriodStart: currentStart.toISOString(),
      currentPeriodEnd: currentEnd.toISOString(),
    };
  }

  async getNewUsersStats(period: AnalyticsPeriod) {
    const { currentStart, currentEnd, previousStart, previousEnd } =
      this.getDateRange(period);

    const [currentCount, previousCount] = await Promise.all([
      this.db.user.count({
        where: {
          createdAt: {
            gte: currentStart,
            lte: currentEnd,
          },
        },
      }),
      this.db.user.count({
        where: {
          createdAt: {
            gte: previousStart,
            lte: previousEnd,
          },
        },
      }),
    ]);

    const percentChange =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : currentCount > 0
          ? 100
          : 0;

    return {
      period,
      newUsers: currentCount,
      previousPeriodNewUsers: previousCount,
      percentChange: Math.round(percentChange * 100) / 100,
      currentPeriodStart: currentStart.toISOString(),
      currentPeriodEnd: currentEnd.toISOString(),
    };
  }

  async getTokenUsageByUser(sort: TokenUsageSort) {
    const _ = sort;
    return { data: [] };
  }
}
