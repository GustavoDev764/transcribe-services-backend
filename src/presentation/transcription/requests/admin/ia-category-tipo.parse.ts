import { IaCategoryKind } from '@prisma/client';

export function parseIaCategoryTipoInput(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  const s = (typeof value === 'string' ? value : String(value)).trim();
  if (s === 'text_generation' || s === 'TEXT_GENERATION') {
    return IaCategoryKind.TEXT_GENERATION;
  }
  if (s === 'audio_and_speech' || s === 'AUDIO_AND_SPEECH') {
    return IaCategoryKind.AUDIO_AND_SPEECH;
  }
  return value;
}
