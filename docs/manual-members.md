# Manual organization members

ChurchFlow separates an organization member record from a platform account. OWNER and ADMIN may add MEMBER or VIEWER records to the organization registry without creating a `User` or `AuthAccount`. Organization-specific contact data lives in `OrganizationMemberProfile`; it never changes the global User profile and is not an authentication identity.

## Account states

- `UNCLAIMED`: the membership has no User.
- `CLAIM_PENDING`: an unused seven-day access link exists.
- `CLAIM_REQUESTED`: a verified Telegram user requested the link and awaits review.
- `CLAIMED`: the membership is connected to a User with an active Telegram AuthAccount.
- `ACCOUNT_DISABLED`: a User is still linked, but its Telegram AuthAccount is inactive; an administrator must resolve the account rather than issue a second claim.

Membership lifecycle (`ACTIVE`, `SUSPENDED`, `REMOVED`) remains separate. Unclaimed members cannot become OWNER or ADMIN.

## Claim flow

1. OWNER or ADMIN generates a cryptographically random claim link. Only its SHA-256 hash is stored.
2. The member opens `/member-claims/accept`, signs in through Telegram with state, PKCE, and nonce, and explicitly requests access.
3. The token becomes unavailable to any other Telegram user.
4. OWNER or ADMIN approves the request.
5. Approval atomically verifies active organization, membership, claimant, and Telegram identity; attaches the User; marks the claim approved; and records audit history.

If that User already has any membership in the organization, approval returns `409 MEMBERSHIP_ALREADY_EXISTS`. ChurchFlow does not silently merge records.

Public claim validation returns only organization name, expiration, and authentication requirement. It never exposes profile contact data or Telegram identifiers. Email is only a delivery channel, and failure after claim creation does not roll back the claim.

## Deletion

Removing a membership revokes active claims but does not delete a User. Deleting a global User sets `OrganizationMember.userId` to null and preserves the organization profile and audit history.
