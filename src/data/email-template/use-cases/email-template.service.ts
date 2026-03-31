import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_CLIENT } from '@app/protocols/database/database-client.interface';
import type { DatabaseClient } from '@app/infrastructure/database/database.types';
import { CreateEmailTemplateDto } from '@app/presentation/email-template/requests/create-email-template.dto';
import { UpdateEmailTemplateDto } from '@app/presentation/email-template/requests/update-email-template.dto';

@Injectable()
export class EmailTemplateService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async create(dto: CreateEmailTemplateDto) {
    return this.db.emailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText ?? null,
      },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [templates, total] = await Promise.all([
      this.db.emailTemplate.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.db.emailTemplate.count(),
    ]);
    return {
      data: templates,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const template = await this.db.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException('Template de email não encontrado');
    }
    return template;
  }

  async findByName(name: string) {
    return this.db.emailTemplate.findFirst({
      where: { name },
    });
  }

  async update(id: string, dto: UpdateEmailTemplateDto) {
    await this.findById(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.bodyHtml !== undefined) data.bodyHtml = dto.bodyHtml;
    if (dto.bodyText !== undefined) data.bodyText = dto.bodyText;

    return this.db.emailTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.db.emailTemplate.delete({
      where: { id },
    });
  }
}
