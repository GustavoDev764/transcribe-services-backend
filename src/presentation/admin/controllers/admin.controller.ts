import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { ManagerGuard } from '@app/presentation/auth/guards/manager.guard';
import { CurrentUser } from '@app/presentation/auth/decorators/current-user.decorator';
import { UserEntity } from '@app/domain/auth/entities/user.entity';
import { AdminUserService } from '@app/data/admin/use-cases/admin-user.service';
import { AdminAnalyticsService } from '@app/data/admin/use-cases/admin-analytics.service';
import { CreateUserDto } from '@app/presentation/admin/requests/create-user.dto';
import { UpdateUserDto } from '@app/presentation/admin/requests/update-user.dto';
import { ListUsersQueryDto } from '@app/presentation/admin/requests/list-users.dto';
import { ResetPasswordDto } from '@app/presentation/admin/requests/reset-password.dto';
import { ListJobsQueryDto } from '@app/presentation/admin/requests/list-jobs.dto';
import { UpdateJobDto } from '@app/presentation/admin/requests/update-job.dto';
import { AdminJobService } from '@app/data/admin/use-cases/admin-job.service';
import {
  ANALYTICS_PERIODS,
  AnalyticsPeriod,
} from '@app/presentation/admin/requests/analytics-period.dto';
import {
  TOKEN_USAGE_SORT,
  TokenUsageSort,
} from '@app/presentation/admin/requests/token-usage-by-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, ManagerGuard)
export class AdminController {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminJobService: AdminJobService,
  ) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: UserEntity) {
    return {
      message: 'Dashboard do administrador',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  // ---- Admin User Service ----
  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUserService.listUsers(query);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.adminUserService.createUser(dto);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminUserService.updateUser(id, dto);
  }

  @Put('users/:id/disable')
  disableUser(@Param('id') id: string) {
    return this.adminUserService.disableUser(id);
  }

  @Put('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.adminUserService.resetPassword(id, dto);
  }

  // ---- Admin Analytics ----
  @Get('analytics/token-usage')
  getTokenUsageStats(
    @Query('period') period?: string,
  ) {
    const safePeriod = ANALYTICS_PERIODS.includes(period as AnalyticsPeriod)
      ? (period as AnalyticsPeriod)
      : 'month';
    return this.adminAnalyticsService.getTokenUsageStats(safePeriod);
  }

  @Get('analytics/new-users')
  getNewUsersStats(@Query('period') period?: string) {
    const safePeriod = ANALYTICS_PERIODS.includes(period as AnalyticsPeriod)
      ? (period as AnalyticsPeriod)
      : 'month';
    return this.adminAnalyticsService.getNewUsersStats(safePeriod);
  }

  @Get('analytics/token-usage-by-user')
  getTokenUsageByUser(@Query('sort') sort?: string) {
    const safeSort = TOKEN_USAGE_SORT.includes(sort as TokenUsageSort)
      ? (sort as TokenUsageSort)
      : 'highest';
    return this.adminAnalyticsService.getTokenUsageByUser(safeSort);
  }

  // ---- Admin Jobs ----
  @Get('jobs')
  listJobs(@Query() query: ListJobsQueryDto) {
    return this.adminJobService.listJobs(query);
  }

  @Put('jobs/:id')
  updateJob(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateJobDto,
  ) {
    return this.adminJobService.updateJobByManager(id, user.id, dto);
  }
}
