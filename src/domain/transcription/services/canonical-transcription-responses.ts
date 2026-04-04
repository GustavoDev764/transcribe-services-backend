function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '';
}

function pickSpeakerId(seg: Record<string, unknown>): string | undefined {
  const sid = seg.speaker_id ?? seg.speakerId;
  if (typeof sid === 'string' && sid.trim()) return sid.trim();
  if (typeof sid === 'number' && !Number.isNaN(sid)) return String(sid);
  const sp = seg.speaker;
  if (typeof sp === 'string' && sp.trim()) return sp.trim();
  if (typeof sp === 'number' && !Number.isNaN(sp)) return String(sp);
  return undefined;
}

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function wordSpeakerId(w: Record<string, unknown>): string | undefined {
  const sid = w.speaker_id ?? w.speakerId;
  if (typeof sid === 'string' && sid.trim()) return sid.trim();
  if (typeof sid === 'number' && !Number.isNaN(sid)) return String(sid);
  return undefined;
}

export function segmentsFromElevenLabsSegmentedJson(
  raw: unknown,
): Record<string, unknown>[] | null {
  const r = asRecord(raw);
  if (!r) return null;
  const formatsRaw: unknown = r.additionalFormats;
  if (!Array.isArray(formatsRaw)) return null;
  const formatsList = formatsRaw as unknown[];
  const segFmt = formatsList.find((f: unknown) => {
    const o = asRecord(f);
    return o?.requestedFormat === 'segmented_json';
  });
  if (!segFmt) return null;
  const o = asRecord(segFmt);
  const content = o?.content;
  if (typeof content !== 'string' || !content.trim()) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
  const segs = data.segments;
  if (!Array.isArray(segs)) return null;

  return segs.map((segment, idx) => {
    const s = asRecord(segment);
    const words = s?.words;
    const text = str(s?.text);
    if (!Array.isArray(words) || words.length === 0) {
      const out: Record<string, unknown> = {
        id: idx,
        text,
        start: num(s?.start) ?? 0,
        end: num(s?.end) ?? 0,
      };
      const sid = pickSpeakerId(s ?? {});
      if (sid) out.speaker_id = sid;
      return out;
    }
    const first = asRecord(words[0]) ?? {};
    const last = asRecord(words[words.length - 1]) ?? {};
    const start = num(first.start) ?? 0;
    const end = num(last.end) ?? num(last.start) ?? start;
    const out: Record<string, unknown> = {
      id: idx,
      text,
      start,
      end,
    };
    const sp = wordSpeakerId(first);
    if (sp) out.speaker_id = sp;
    return out;
  });
}

type ElevenWord = Record<string, unknown>;

function isContentWord(w: ElevenWord): boolean {
  if (w.type === 'spacing') return false;
  const t = str(w.text).trim();
  if (!t) return false;
  return typeof w.start === 'number' && typeof w.end === 'number';
}

function segmentsFromRootWordsFallback(
  words: unknown[],
  fullText: string,
): Record<string, unknown>[] {
  const timed = words.filter((x) =>
    isContentWord(x as ElevenWord),
  ) as ElevenWord[];
  if (timed.length === 0) {
    const t = fullText.trim();
    if (!t) return [];
    return [{ id: 0, start: 0, end: 0, text: t }];
  }
  const first = timed[0];
  const last = timed[timed.length - 1];
  const start = num(first.start) ?? 0;
  const end = num(last.end) ?? start;
  const out: Record<string, unknown> = {
    id: 0,
    start,
    end,
    text: fullText.trim() || timed.map((w) => str(w.text).trim()).join(' '),
  };
  const sp = wordSpeakerId(first);
  if (sp) out.speaker_id = sp;
  return [out];
}

function normalizeSegmentFromProvider(
  raw: unknown,
  index: number,
): Record<string, unknown> {
  const s = asRecord(raw) ?? {};
  const start = num(s.start) ?? 0;
  const end = num(s.end) ?? start;
  const text = str(s.text);
  const seekVal = num(s.seek);
  const id = s.id !== undefined ? s.id : index;
  const speakerId = pickSpeakerId(s);

  const out: Record<string, unknown> = {
    id,
    start,
    end,
    text,
  };
  if (seekVal !== undefined && seekVal !== 0) {
    out.seek = seekVal;
  }
  if (speakerId) {
    out.speaker_id = speakerId;
  }
  return out;
}

function pickLanguage(src: Record<string, unknown>): string {
  const a = str(src.language).trim();
  if (a) return a;
  const b = str(src.language_code).trim();
  if (b) return b;
  const task = asRecord(src.task);
  const c = task ? str(task.language).trim() : '';
  return c;
}

function pickOptionalProgress(
  root: Record<string, unknown>,
): number | undefined {
  const direct = num(root.progress);
  if (direct !== undefined)
    return Math.min(100, Math.max(0, Math.round(direct)));
  const pct = num(root.percent);
  if (pct !== undefined) return Math.min(100, Math.max(0, Math.round(pct)));
  const task = asRecord(root.task);
  if (task) {
    const tp = num(task.progress);
    if (tp !== undefined) return Math.min(100, Math.max(0, Math.round(tp)));
    const tpct = num(task.percent);
    if (tpct !== undefined) return Math.min(100, Math.max(0, Math.round(tpct)));
  }
  const output = asRecord(root.output);
  if (output) {
    const op = num(output.progress);
    if (op !== undefined) return Math.min(100, Math.max(0, Math.round(op)));
  }
  return undefined;
}

function pickOptionalStatus(root: Record<string, unknown>): string | undefined {
  const s = root.status;
  if (typeof s === 'string' && s.trim()) return s.trim();
  if (typeof s === 'number' && !Number.isNaN(s)) return String(s);
  const task = asRecord(root.task);
  const ts = task?.status;
  if (typeof ts === 'string' && ts.trim()) return ts.trim();
  if (typeof ts === 'number' && !Number.isNaN(ts)) return String(ts);
  return undefined;
}

function pickText(
  src: Record<string, unknown>,
  segments: Record<string, unknown>[],
): string {
  const a = str(src.text).trim();
  if (a) return a;
  const b = str(src.text_content).trim();
  if (b) return b;
  const task = asRecord(src.task);
  const c = task ? str(task.text).trim() : '';
  if (c) return c;
  if (segments.length > 0) {
    return segments
      .map((s) => str(s.text).trim())
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

function existingSegmentsArray(src: Record<string, unknown>): unknown[] {
  const task = asRecord(src.task);
  const output = asRecord(src.output);
  const candidates = [src.segments, task?.segments, output?.segments];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function shouldUseRootWordsFallback(src: Record<string, unknown>): boolean {
  const words = src.words;
  return Array.isArray(words) && words.length > 0;
}

export function buildCanonicalTranscriptionResponses(
  raw: unknown,
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { language: '', text: '', segments: [] };
  }

  const src = cloneJson(raw) as Record<string, unknown>;
  delete src.words;

  let segments: Record<string, unknown>[] = [];
  let usedSegmentedJson = false;

  const fromSegJson = segmentsFromElevenLabsSegmentedJson(raw);
  if (fromSegJson && fromSegJson.length > 0) {
    segments = fromSegJson;
    usedSegmentedJson = true;
  }

  if (segments.length === 0) {
    const arr = existingSegmentsArray(raw as Record<string, unknown>);
    if (arr.length > 0) {
      segments = arr.map((s, i) => normalizeSegmentFromProvider(s, i));
    }
  }

  if (
    segments.length === 0 &&
    shouldUseRootWordsFallback(raw as Record<string, unknown>)
  ) {
    const rootWords = (raw as Record<string, unknown>).words as unknown[];
    const fullText = str((raw as Record<string, unknown>).text);
    segments = segmentsFromRootWordsFallback(rootWords, fullText);
  }

  const language = pickLanguage(src);
  let text = pickText(src, segments);

  if (segments.length === 0 && text) {
    const single: Record<string, unknown> = {
      id: 0,
      start: 0,
      end: 0,
      text,
    };
    segments = [single];
  } else if (segments.length > 0 && !text) {
    text = pickText({ ...src, text: '' }, segments);
  }

  const out = { ...src } as Record<string, unknown>;
  delete out.words;
  if (usedSegmentedJson) {
    delete out.additionalFormats;
  }
  out.language = language;
  out.text = text;
  out.segments = segments;

  const rawRoot = asRecord(raw) ?? {};
  delete out.progress;
  delete out.status;
  const progressOpt = pickOptionalProgress(rawRoot);
  const statusOpt = pickOptionalStatus(rawRoot);
  if (progressOpt !== undefined) out.progress = progressOpt;
  if (statusOpt !== undefined) out.status = statusOpt;

  return out;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function canonicalSegmentsToSrt(
  segments: Array<Record<string, unknown>>,
): string {
  if (!segments.length) return '';
  return segments
    .map((seg, i) => {
      const start = num(seg.start) ?? 0;
      const end = num(seg.end) ?? start;
      const line = str(seg.text).replace(/\n/g, ' ').trim();
      return `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${line}\n`;
    })
    .join('\n');
}

export function srtFromStoredResponses(responses: unknown): string | null {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
    return null;
  }
  const r = responses as Record<string, unknown>;
  const segs = r.segments;
  if (Array.isArray(segs) && segs.length > 0) {
    const srt = canonicalSegmentsToSrt(segs as Record<string, unknown>[]);
    if (srt.trim()) return srt;
  }
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  if (text) {
    return `1\n00:00:00,000 --> 00:00:10,000\n${text}\n`;
  }
  return null;
}
