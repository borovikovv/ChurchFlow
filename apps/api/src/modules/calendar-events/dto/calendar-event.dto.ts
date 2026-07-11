import {
  createCalendarEventSchema,
  listCalendarEventsQuerySchema,
  toggleCalendarTaskCompletionSchema,
  updateCalendarEventSchema,
  updateCalendarPreferencesSchema,
} from '@churchflow/shared';
import type {
  CalendarEventType,
  CreateCalendarEventInput,
  ListCalendarEventsQuery,
  ToggleCalendarTaskCompletionInput,
  UpdateCalendarEventInput,
  UpdateCalendarPreferencesInput,
} from '@churchflow/shared';

export class ListCalendarEventsQueryDto implements ListCalendarEventsQuery {
  static readonly schema = listCalendarEventsQuerySchema;

  rangeStart!: string;
  rangeEnd!: string;
  types?: CalendarEventType[];
}

export class CreateCalendarEventDto implements CreateCalendarEventInput {
  static readonly schema = createCalendarEventSchema;

  type!: CreateCalendarEventInput['type'];
  title!: string;
  description?: string | null;
  startsAt!: string;
  endsAt?: string | null;
  allDay!: boolean;
  reminder?: CreateCalendarEventInput['reminder'];
  repeatPeriod!: CreateCalendarEventInput['repeatPeriod'];
  linkedMembershipId?: string | null;
  imageAssetId?: string | null;
  assigneeMembershipIds!: string[];
  taskCompleted!: boolean;
  serviceDetails?: CreateCalendarEventInput['serviceDetails'];
}

export class UpdateCalendarEventDto implements UpdateCalendarEventInput {
  static readonly schema = updateCalendarEventSchema;

  type?: UpdateCalendarEventInput['type'];
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  allDay?: boolean;
  reminder?: UpdateCalendarEventInput['reminder'];
  repeatPeriod?: UpdateCalendarEventInput['repeatPeriod'];
  linkedMembershipId?: string | null;
  imageAssetId?: string | null;
  assigneeMembershipIds?: string[];
  taskCompleted?: boolean;
  serviceDetails?: UpdateCalendarEventInput['serviceDetails'];
}

export class ToggleCalendarTaskCompletionDto implements ToggleCalendarTaskCompletionInput {
  static readonly schema = toggleCalendarTaskCompletionSchema;

  completed!: boolean;
}

export class UpdateCalendarPreferencesDto implements UpdateCalendarPreferencesInput {
  static readonly schema = updateCalendarPreferencesSchema;

  visibleEventTypes!: CalendarEventType[];
}
