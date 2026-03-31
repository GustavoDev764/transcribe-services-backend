import { Injectable } from '@nestjs/common';

export type TranscriptionErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_AUDIO'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

@Injectable()
export class TranscriptionDomainService {
  shouldFallback(errorCode: TranscriptionErrorCode): boolean {
    if (errorCode === 'INVALID_AUDIO' || errorCode === 'VALIDATION_ERROR') {
      return false;
    }
    return true;
  }
}
