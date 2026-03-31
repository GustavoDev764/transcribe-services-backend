import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FolderService } from '@app/data/folder/use-cases/folder.service';
import { CreateFolderDto } from '@app/presentation/folder/requests/create-folder.dto';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@app/presentation/auth/guards/permission.guard';
import { RequirePermission } from '@app/presentation/auth/decorators/require-permission.decorator';
import { CurrentUser } from '@app/presentation/auth/decorators/current-user.decorator';
import { UserEntity } from '@app/domain/auth/entities/user.entity';
import { PERMISSIONS } from '@app/domain/constants/permissions.constants';
import { PaginationQueryDto } from '@app/domain/dtos/pagination.dto';
import { UpdateFolderDto } from '@app/presentation/folder/requests/update-folder.dto';

@Controller('folders')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(PERMISSIONS.FOLDER_WRITE)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  create(@CurrentUser() user: UserEntity, @Body() dto: CreateFolderDto) {
    return this.folderService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: UserEntity, @Query() query: PaginationQueryDto) {
    return this.folderService.findAllByUser(
      user.id,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.folderService.findOne(id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folderService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.folderService.remove(id, user.id);
  }
}
