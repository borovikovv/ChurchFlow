import type { TabItem } from '@/components/ui/tabs';
import type { AppMessages } from '@/i18n/messages';
import {
  organizationProfileNotificationsRoute,
  organizationProfilePasskeysRoute,
  organizationProfileRoute,
  organizationProfileSessionsRoute,
} from '@/features/organizations/routes';

export function profileTabItems(organizationId: string, messages: AppMessages): TabItem[] {
  return [
    { label: messages.profile.title, href: organizationProfileRoute(organizationId) },
    {
      label: messages.profile.notifications,
      href: organizationProfileNotificationsRoute(organizationId),
    },
    { label: messages.sessions.title, href: organizationProfileSessionsRoute(organizationId) },
    { label: messages.passkeys.title, href: organizationProfilePasskeysRoute(organizationId) },
  ];
}
