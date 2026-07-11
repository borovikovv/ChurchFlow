import type {
  CalendarEventItem,
  CalendarEventReminder,
  CalendarEventRepeatPeriod,
  CalendarEventsPayload,
  CalendarEventType,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '@churchflow/shared';

export type CalendarActionResult<T> = Promise<({ ok: true } & T) | { ok: false; error: string }>;

export interface CalendarFormState {
  type: CalendarEventType;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  reminder: '' | CalendarEventReminder;
  repeatPeriod: CalendarEventRepeatPeriod;
  linkedMembershipId: string;
  imageAssetId: string;
  imageUrl: string | null;
  assigneeMembershipIds: string[];
  taskCompleted: boolean;
  serviceDetails: CalendarServiceFormDetails;
}

export interface CalendarServiceFormPerson {
  membershipId: string;
  customName: string;
}

export interface CalendarServiceFormDetails {
  preacher: CalendarServiceFormPerson;
  serviceHost: CalendarServiceFormPerson;
  worshipLead: CalendarServiceFormPerson;
  hasCommunion: boolean;
  communionLead: CalendarServiceFormPerson;
  biblePassage: string;
  songs: string;
}

export interface CalendarManagerActions {
  loadEvents: (input: {
    organizationId: string;
    rangeStart: string;
    rangeEnd: string;
    types: CalendarEventType[];
  }) => CalendarActionResult<{ payload: CalendarEventsPayload }>;
  updatePreferences: (input: {
    organizationId: string;
    visibleEventTypes: CalendarEventType[];
  }) => CalendarActionResult<{ preferences: { visibleEventTypes: CalendarEventType[] } }>;
  createEvent: (input: {
    organizationId: string;
    event: CreateCalendarEventInput;
  }) => CalendarActionResult<{ event: CalendarEventItem }>;
  updateEvent: (input: {
    organizationId: string;
    eventId: string;
    event: UpdateCalendarEventInput;
  }) => CalendarActionResult<{ event: CalendarEventItem }>;
  deleteEvent: (input: {
    organizationId: string;
    eventId: string;
  }) => CalendarActionResult<{ deletedEventId: string }>;
  toggleTaskCompletion: (input: {
    organizationId: string;
    eventId: string;
    completed: boolean;
  }) => CalendarActionResult<{ event: CalendarEventItem }>;
  prepareImage: (input: {
    organizationId: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) => CalendarActionResult<{ assetId: string; uploadUrl: string }>;
  confirmImage: (input: {
    organizationId: string;
    assetId: string;
  }) => CalendarActionResult<{ assetId: string; imageUrl: string }>;
}
