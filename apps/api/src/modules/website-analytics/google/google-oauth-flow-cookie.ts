import { z } from 'zod';
import type { GoogleOAuthFlowState } from '../website-analytics.service';

export const GOOGLE_OAUTH_FLOW_COOKIE = 'cf_ga_oauth';
export const GOOGLE_OAUTH_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

const flowSchema = z.object({
  organizationId: z.string().uuid(),
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
});

/**
 * The flow travels in an httpOnly cookie only this API sets. Matching its state against the one
 * Google echoes back is what ties the callback to the browser that started the consent.
 */
export function encodeGoogleOAuthFlow(flow: GoogleOAuthFlowState): string {
  return Buffer.from(JSON.stringify(flow), 'utf8').toString('base64url');
}

export function decodeGoogleOAuthFlow(value: string | undefined): GoogleOAuthFlowState | null {
  if (!value) return null;

  try {
    const parsed = flowSchema.safeParse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
