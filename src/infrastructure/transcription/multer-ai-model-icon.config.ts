import { memoryStorage } from 'multer';
import type { Request } from 'express';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

export const multerAiModelIconConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 512 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_MIME.has(mime)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        'Formato inválido. Use PNG, JPEG, WebP (128x128 px) ou SVG.',
      ),
      false,
    );
  },
};
