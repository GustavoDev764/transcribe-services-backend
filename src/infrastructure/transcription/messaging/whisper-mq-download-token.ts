import { createHmac, timingSafeEqual } from 'crypto';

const MAX_FUTURE_SKEW_SEC = 7 * 24 * 3600;

export function signWhisperMqJobSource(
  secret: string,
  jobId: string,
  ttlSec: number,
): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac('sha256', secret)
    .update(`${jobId}:${exp}`)
    .digest('hex');
  return { exp, sig };
}

export function verifyWhisperMqJobSource(
  secret: string,
  jobId: string,
  expStr: string,
  sigHex: string,
): boolean {
  if (!secret || !sigHex || !expStr) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < 0) return false;
  const now = Math.floor(Date.now() / 1000);
  if (exp < now - 120) return false;
  if (exp > now + MAX_FUTURE_SKEW_SEC) return false;
  const expected = createHmac('sha256', secret)
    .update(`${jobId}:${exp}`)
    .digest('hex');
  try {
    const a = Buffer.from(sigHex, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildWhisperMqSourceDownloadUrl(
  publicBaseUrl: string,
  jobId: string,
  secret: string,
  ttlSec: number,
): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  const { exp, sig } = signWhisperMqJobSource(secret, jobId, ttlSec);
  return `${base}/internal/whisper-mq/transcription-jobs/${encodeURIComponent(jobId)}/source?exp=${exp}&sig=${sig}`;
}
