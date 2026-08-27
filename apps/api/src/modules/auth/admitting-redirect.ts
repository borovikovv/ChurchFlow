import { extractRedirectToken } from '../../common/auth/internal-redirect';
import { hashOpaqueToken } from '../../common/auth/session-token';

// Two kinds of admission meet here. A live claimable invitation, first-admin bootstrap or
// member-claim link puts the credential in the redirect itself, and its holder may sign in with
// whatever they can prove they own. Organization onboarding carries no token: it is the way in
// for somebody nobody has invited yet, and the same door Telegram already opens.
//
// Every provider asks this same question, so it lives here rather than beside any one of them.

export interface AdmittingRedirectTokens {
  hasValidClaimableInvitationTokenHash(tokenHash: string): Promise<boolean>;
  hasValidPlatformAdminBootstrapTokenHash(tokenHash: string): Promise<boolean>;
  hasValidMembershipClaimTokenHash(tokenHash: string): Promise<boolean>;
}

const ORGANIZATION_ONBOARDING_PATHS: ReadonlyArray<string> = [
  '/organization-request',
  '/organization-request/status',
];

export async function hasAdmittingRedirect(
  redirectTo: string | null,
  tokens: AdmittingRedirectTokens,
): Promise<boolean> {
  if (isOrganizationOnboardingRedirect(redirectTo)) {
    return true;
  }

  const candidates: ReadonlyArray<[string, (tokenHash: string) => Promise<boolean>]> = [
    ['/invitations/accept', (tokenHash) => tokens.hasValidClaimableInvitationTokenHash(tokenHash)],
    [
      '/platform-admin/bootstrap',
      (tokenHash) => tokens.hasValidPlatformAdminBootstrapTokenHash(tokenHash),
    ],
    ['/member-claims/accept', (tokenHash) => tokens.hasValidMembershipClaimTokenHash(tokenHash)],
  ];

  for (const [path, isValid] of candidates) {
    const token = extractRedirectToken(redirectTo ?? undefined, path);
    if (token && (await isValid(hashOpaqueToken(token)))) {
      return true;
    }
  }

  return false;
}

export function isOrganizationOnboardingRedirect(redirectTo: string | null): boolean {
  const path = redirectPath(redirectTo);

  return path !== null && ORGANIZATION_ONBOARDING_PATHS.includes(path);
}

// Everything that identifies the caller or carries a token lives past the path, so this is also
// what a refusal log is allowed to say.
export function redirectPath(redirectTo: string | null): string | null {
  if (!redirectTo) {
    return null;
  }

  const end = redirectTo.search(/[?#]/);

  return end < 0 ? redirectTo : redirectTo.slice(0, end);
}
