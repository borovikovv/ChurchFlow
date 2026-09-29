import type { TabItem } from '@/components/ui/tabs';
import {
  organizationWebsiteAnalyticsRoute,
  organizationWebsiteRoute,
} from '@/features/organizations/routes';
import type { AppMessages } from '@/i18n/messages';

export function websiteTabItems(
  organizationId: string,
  messages: AppMessages['website'],
): TabItem[] {
  return [
    { label: messages.tabs.editor, href: organizationWebsiteRoute(organizationId) },
    { label: messages.tabs.analytics, href: organizationWebsiteAnalyticsRoute(organizationId) },
  ];
}
