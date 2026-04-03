import { IaCategoryKind } from '@prisma/client';

/** Aceita valores do Prisma (TEXT_GENERATION) ou wire snake_case (text_generation). */
export function parseIaCategoryTipoInput(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const s = String(value).trim();
  if (s === 'text_generation' || s === 'TEXT_GENERATION') {
    return IaCategoryKind.TEXT_GENERATION;
  }
  if (s === 'audio_and_speech' || s === 'AUDIO_AND_SPEECH') {
    return IaCategoryKind.AUDIO_AND_SPEECH;
  }
  return value;
}
