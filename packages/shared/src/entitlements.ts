export const ENTITLEMENTS = {
  membersRead: 'members.read',
  membersWrite: 'members.write',
  calendarRead: 'calendar.read',
  calendarWrite: 'calendar.write',
  prayersRead: 'prayers.read',
  prayersWrite: 'prayers.write',
  websiteRead: 'website.read',
  websiteWrite: 'website.write',
  filesRead: 'files.read',
  filesUpload: 'files.upload',
  budgetRead: 'budget.read',
  budgetWrite: 'budget.write',
} as const;

export type Entitlement = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

export const SUBSCRIPTION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'PAST_DUE',
  'RESTRICTED',
  'CANCELED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * The transition window given to organizations that already existed when billing shipped, and
 * the grace period after a failed payment. They share a length today but answer different
 * questions, so they stay separate: changing one must not move the other.
 */
export const BILLING_TRANSITION_WINDOW_DAYS = 7;
export const BILLING_GRACE_PERIOD_DAYS = 7;

/** The price is charged in UAH, at the equivalent of this many US dollars per month. */
export const SUBSCRIPTION_USD_REFERENCE_AMOUNT = 4.5;

export const ALL_ENTITLEMENTS: readonly Entitlement[] = Object.freeze(Object.values(ENTITLEMENTS));

export const READ_ENTITLEMENTS: readonly Entitlement[] = Object.freeze([
  ENTITLEMENTS.membersRead,
  ENTITLEMENTS.calendarRead,
  ENTITLEMENTS.prayersRead,
  ENTITLEMENTS.websiteRead,
  ENTITLEMENTS.filesRead,
  ENTITLEMENTS.budgetRead,
]);

export const NO_ENTITLEMENTS: readonly Entitlement[] = Object.freeze([]);

export interface SubscriptionEntitlementState {
  status: SubscriptionStatus;
  isExempt: boolean;
  restrictAfter: Date | null;
  graceEndsAt: Date | null;
}

export interface EntitlementInput {
  /** Null means the organization has no subscription row at all. */
  subscription: SubscriptionEntitlementState | null;
  now: Date;
  enforcementEnabled: boolean;
}

function isBeforeDeadline(now: Date, deadline: Date | null): boolean {
  return deadline !== null && now.getTime() < deadline.getTime();
}

type EntitlementRule = (
  subscription: SubscriptionEntitlementState,
  now: Date,
) => readonly Entitlement[];

// A Record keyed by the status union rather than a switch: adding a status to
// SUBSCRIPTION_STATUSES without deciding what it grants is then a compile error.
const RULES_BY_STATUS: Record<SubscriptionStatus, EntitlementRule> = {
  ACTIVE: () => ALL_ENTITLEMENTS,
  PENDING: (subscription, now) =>
    isBeforeDeadline(now, subscription.restrictAfter) ? ALL_ENTITLEMENTS : READ_ENTITLEMENTS,
  PAST_DUE: (subscription, now) =>
    isBeforeDeadline(now, subscription.graceEndsAt) ? ALL_ENTITLEMENTS : READ_ENTITLEMENTS,
  RESTRICTED: () => READ_ENTITLEMENTS,
  CANCELED: () => READ_ENTITLEMENTS,
};

/**
 * The single place subscription state turns into permissions. Pure on purpose: no database, no
 * clock, no framework, so every branch is directly testable.
 *
 * Order matters. Enforcement off wins over everything so local and test environments are never
 * restricted; a missing subscription row then fails closed, because "no row" must never read as
 * "allowed"; and only then does complimentary access or the status itself decide.
 */
export function resolveEntitlements(input: EntitlementInput): readonly Entitlement[] {
  const { subscription, now, enforcementEnabled } = input;

  if (!enforcementEnabled) {
    return ALL_ENTITLEMENTS;
  }

  if (!subscription) {
    return NO_ENTITLEMENTS;
  }

  if (subscription.isExempt) {
    return ALL_ENTITLEMENTS;
  }

  return RULES_BY_STATUS[subscription.status](subscription, now);
}

export function hasEntitlement(granted: readonly Entitlement[], entitlement: Entitlement): boolean {
  return granted.includes(entitlement);
}
