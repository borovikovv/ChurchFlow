import {
  AI_ASSISTANT_CONFIRMATION_LIMIT_ERROR_CODE,
  AI_ASSISTANT_DUPLICATE_MESSAGE_ERROR_CODE,
  AI_ASSISTANT_QUOTA_EXHAUSTED_ERROR_CODE,
  AI_ASSISTANT_UNAVAILABLE_ERROR_CODE,
} from '@churchflow/shared';
import type { AiAssistantErrorKind } from '../types/ai-assistant-view';

export function aiAssistantErrorKindFromCode(code: string | null): AiAssistantErrorKind {
  switch (code) {
    case AI_ASSISTANT_QUOTA_EXHAUSTED_ERROR_CODE:
      return 'quotaExhausted';
    case AI_ASSISTANT_UNAVAILABLE_ERROR_CODE:
      return 'unavailable';
    case AI_ASSISTANT_DUPLICATE_MESSAGE_ERROR_CODE:
      return 'duplicate';
    case AI_ASSISTANT_CONFIRMATION_LIMIT_ERROR_CODE:
      return 'confirmationLimit';
    default:
      return 'generic';
  }
}

function errorEnvelopeCode(body: unknown): string | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'code' in body.error &&
    typeof body.error.code === 'string'
  ) {
    return body.error.code;
  }

  return null;
}

/** useChat reports a refused request with the raw response body as the error message. */
export function aiAssistantChatErrorKind(error: Error): AiAssistantErrorKind {
  let body: unknown;

  try {
    body = JSON.parse(error.message);
  } catch {
    return 'generic';
  }

  return aiAssistantErrorKindFromCode(errorEnvelopeCode(body));
}
