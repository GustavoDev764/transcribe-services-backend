import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@app/presentation/auth/guards/jwt-auth.guard';
import {
  TranslateService,
  LanguageOption,
  TranslateResult,
} from '@app/data/translate/translate.service';
import { TranslateRequestDto } from '@app/presentation/translate/requests/translate.dto';
import { TranslateSegmentsRequestDto } from '@app/presentation/translate/requests/translate-segments.dto';

@Controller('translate')
@UseGuards(JwtAuthGuard)
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Get('languages')
  async getLanguages(
    @Query('target') target?: string,
  ): Promise<{ languages: LanguageOption[] }> {
    const languages = await this.translateService.getLanguages(target);
    return { languages };
  }

  /** Lista apenas os idiomas habilitados no painel Manage (Config → Google). Usado pelo frontend na página de tradução. */
  @Get('enabled-languages')
  async getEnabledLanguages(): Promise<{ languages: LanguageOption[] }> {
    const languages = await this.translateService.getEnabledLanguages();
    return { languages };
  }

  /** Traduz vários trechos (segmentos) em uma única requisição. Retorna translations na mesma ordem. */
  @Post('segments')
  async translateSegments(@Body() dto: TranslateSegmentsRequestDto): Promise<{
    translations: string[];
    sourceLanguage: string;
    targetLanguage: string;
    detectedSourceLanguage?: string;
  }> {
    try {
      const texts = (dto.texts ?? []).map((t) =>
        typeof t === 'string' ? t : String(t),
      );
      return await this.translateService.translateTexts(
        texts,
        dto.targetLanguage,
        dto.sourceLanguage === 'detect' ? undefined : dto.sourceLanguage,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao traduzir';
      throw new BadRequestException(message);
    }
  }

  @Post()
  async translate(@Body() dto: TranslateRequestDto): Promise<TranslateResult> {
    try {
      return await this.translateService.translateText(
        dto.text,
        dto.targetLanguage,
        dto.sourceLanguage === 'detect' ? undefined : dto.sourceLanguage,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao traduzir';
      throw new BadRequestException(message);
    }
  }
}
