import {
  appLocaleOrFallback,
  CALENDAR_SERVICE_ROLE_LABELS_BY_LOCALE,
  type CalendarServiceRole,
} from '@churchflow/shared';

/** Short role names ("Preacher", "Sound") shared with the API and its notifications. */
export function serviceRoleLabel(locale: string, role: CalendarServiceRole): string {
  return CALENDAR_SERVICE_ROLE_LABELS_BY_LOCALE[appLocaleOrFallback(locale)][role];
}
