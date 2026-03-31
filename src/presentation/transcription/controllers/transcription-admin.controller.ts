import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { ManagerGuard } from '@app/presentation/auth/guards/manager.guard';
import { RequirePermission } from '@app/presentation/auth/decorators/require-permission.decorator';
import { PERMISSIONS } from '@app/domain/constants/permissions.constants';
import { CreateProviderDto } from '@app/presentation/transcription/requests/admin/create-provider.dto';
import { CreateCredentialDto } from '@app/presentation/transcription/requests/admin/create-credential.dto';
import { CreateModelDto } from '@app/presentation/transcription/requests/admin/create-model.dto';
import { TranscriptionAdminService } from '@app/data/transcription/use-cases/transcription-admin.service';

@Controller('admin/transcription')
@UseGuards(JwtAuthGuard, ManagerGuard)
@RequirePermission(PERMISSIONS.MANAGE_AI)
export class TranscriptionAdminController {
  constructor(private readonly adminService: TranscriptionAdminService) {}

  @Get('providers')
  listProviders() {
    return this.adminService.listProviders();
  }

  @Post('providers')
  createProvider(@Body() dto: CreateProviderDto) {
    return this.adminService.createProvider(dto);
  }

  @Put('providers/:id')
  updateProvider(@Param('id') id: string, @Body() dto: CreateProviderDto) {
    return this.adminService.updateProvider(id, dto);
  }

  @Delete('providers/:id')
  deleteProvider(@Param('id') id: string) {
    return this.adminService.deleteProvider(id);
  }

  @Get('providers/:id/credentials')
  listCredentials(@Param('id') providerId: string) {
    return this.adminService.listCredentials(providerId);
  }

  @Post('providers/:id/credentials')
  createCredential(
    @Param('id') providerId: string,
    @Body() dto: CreateCredentialDto,
  ) {
    return this.adminService.createCredential(providerId, dto);
  }

  @Put('credentials/:id')
  updateCredential(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCredentialDto>,
  ) {
    return this.adminService.updateCredential(id, dto);
  }

  @Delete('credentials/:id')
  deleteCredential(@Param('id') id: string) {
    return this.adminService.deleteCredential(id);
  }

  @Get('models')
  listModels() {
    return this.adminService.listModels();
  }

  @Post('models')
  createModel(@Body() dto: CreateModelDto) {
    return this.adminService.createModel(dto);
  }

  @Put('models/:id')
  updateModel(@Param('id') id: string, @Body() dto: Partial<CreateModelDto>) {
    return this.adminService.updateModel(id, dto);
  }

  @Delete('models/:id')
  deleteModel(@Param('id') id: string) {
    return this.adminService.deleteModel(id);
  }
}
