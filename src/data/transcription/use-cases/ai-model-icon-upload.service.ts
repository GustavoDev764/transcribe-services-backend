import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sizeOf from 'image-size';

const ICON_SUBDIR = path.join('public', 'ai-model-icons');

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function displayNameFromOriginal(originalname: string): string {
  const base = path.basename(originalname || 'icon');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'icon';
}

function isLikelySvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString('utf8');
  return /^\s*(<\?xml|<svg\b)/i.test(head);
}

@Injectable()
export class AiModelIconUploadService {
  async saveValidatedIcon(file: Express.Multer.File): Promise<{
    url: string;
    filename: string;
  }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const mime = (file.mimetype || '').toLowerCase();
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      throw new BadRequestException('Tipo de arquivo não permitido');
    }

    if (mime === 'image/svg+xml' || ext === '.svg') {
      if (!isLikelySvg(file.buffer)) {
        throw new BadRequestException('Arquivo SVG inválido');
      }
    } else {
      let dimensions: { width?: number; height?: number };
      try {
        dimensions = sizeOf(file.buffer);
      } catch {
        throw new BadRequestException('Não foi possível ler a imagem');
      }
      if (!dimensions.width || !dimensions.height) {
        throw new BadRequestException('Não foi possível obter dimensões da imagem');
      }
      if (dimensions.width !== 128 || dimensions.height !== 128) {
        throw new BadRequestException(
          'Imagem raster deve ter exatamente 128x128 pixels',
        );
      }
    }

    const storedName = `${randomUUID()}${ext}`;
    const dir = path.join(process.cwd(), ICON_SUBDIR);
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, storedName);
    await fs.writeFile(fullPath, file.buffer);

    const publicPath = `/public/ai-model-icons/${storedName}`;
    return {
      url: publicPath,
      filename: displayNameFromOriginal(file.originalname),
    };
  }
}
