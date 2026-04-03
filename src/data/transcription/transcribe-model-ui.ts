export const TRANSCRIBE_MODEL_UI_CONFIG_KEY = 'TRANSCRIBE_MODEL_UI_CONFIG';

export type TranscribeModelUiRow = {
  label: string;
  icon_data_url: string | null;
};

export type TranscribeModelUiMerged = {
  tiny: TranscribeModelUiRow;
  base: TranscribeModelUiRow;
  small: TranscribeModelUiRow;
};

export function defaultTranscribeModelUi(): TranscribeModelUiMerged {
  return {
    tiny: { label: 'Rápido', icon_data_url: null },
    base: { label: 'Equilibrado', icon_data_url: null },
    small: { label: 'Maior precisão', icon_data_url: null },
  };
}

export function mergeTranscribeModelUiFromJson(
  raw: string | null,
): TranscribeModelUiMerged {
  const base = defaultTranscribeModelUi();
  if (!raw?.trim()) return base;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return base;
    const obj = o as Record<string, unknown>;
    for (const k of ['tiny', 'base', 'small'] as const) {
      const e = obj[k];
      if (e && typeof e === 'object' && !Array.isArray(e)) {
        const rec = e as Record<string, unknown>;
        if (typeof rec.label === 'string' && rec.label.trim()) {
          base[k].label = rec.label.trim();
        }
        if (
          typeof rec.icon_data_url === 'string' &&
          rec.icon_data_url.startsWith('data:')
        ) {
          base[k].icon_data_url = rec.icon_data_url;
        }
      }
    }
  } catch {
    return defaultTranscribeModelUi();
  }
  return base;
}
