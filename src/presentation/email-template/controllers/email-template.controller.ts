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
import { EmailTemplateService } from '@app/data/email-template/use-cases/email-template.service';
import { CreateEmailTemplateDto } from '@app/presentation/email-template/requests/create-email-template.dto';
import { UpdateEmailTemplateDto } from '@app/presentation/email-template/requests/update-email-template.dto';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import { ManagerGuard } from '@app/presentation/auth/guards/manager.guard';
import { PaginationQueryDto } from '@app/domain/dtos/pagination.dto';

@Controller('admin/email-templates')
@UseGuards(JwtAuthGuard, ManagerGuard)
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Post()
  create(@Body() dto: CreateEmailTemplateDto) {
    return this.emailTemplateService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.emailTemplateService.findAll(
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.emailTemplateService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplateService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emailTemplateService.remove(id);
  }
}
