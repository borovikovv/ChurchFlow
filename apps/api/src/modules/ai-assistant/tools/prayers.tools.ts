import { tool } from 'ai';
import { z } from 'zod';
import { ENTITLEMENTS, createPrayerRequestSchema } from '@churchflow/shared';
import { PrayerRequestsController } from '../../prayer-requests/prayer-requests.controller';
import type { PrayerRequestsService } from '../../prayer-requests/prayer-requests.service';
import { jsonInput, localized, type AiToolMeta } from './ai-tool';
import type { AiToolRunner } from './ai-tool-runner';

const LIST_PAGE_SIZE = 25;

export const PRAYERS_TOOL_META = {
  listPrayerRequests: {
    name: 'listPrayerRequests',
    group: 'prayers',
    risk: 'READ',
    policy: {},
    route: { controller: PrayerRequestsController, handler: 'list' },
  },
  createPrayerRequest: {
    name: 'createPrayerRequest',
    group: 'prayers',
    risk: 'WRITE',
    policy: { entitlement: ENTITLEMENTS.prayersWrite },
    route: { controller: PrayerRequestsController, handler: 'create' },
  },
} satisfies Record<string, AiToolMeta>;

export const createPrayerRequestInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5000),
});

export function prayersTools(runner: AiToolRunner, prayerRequestsService: PrayerRequestsService) {
  const { organizationId, userId, locale } = runner.context;
  const prayersLink = {
    kind: 'prayerRequests' as const,
    id: null,
    label: localized(locale, { en: 'Prayer requests', uk: 'Молитовні потреби' }),
  };

  return {
    listPrayerRequests: tool({
      description: 'The newest active prayer requests the user can see, with author and date.',
      inputSchema: z.object({}),
      execute: (input, { toolCallId }) =>
        runner.read(
          PRAYERS_TOOL_META.listPrayerRequests,
          toolCallId,
          jsonInput(input),
          async () => {
            const payload = await prayerRequestsService.listForOrganization(
              organizationId,
              userId,
              {
                tab: 'active',
                page: 1,
                pageSize: LIST_PAGE_SIZE,
              },
            );

            return {
              ok: true,
              summary: localized(locale, {
                en: `${String(payload.counts.active)} active prayer requests.`,
                uk: `Активних молитовних потреб: ${String(payload.counts.active)}.`,
              }),
              links: [prayersLink],
              data: {
                total: payload.counts.active,
                requests: payload.items.map((item) => ({
                  title: item.title,
                  description: item.description.slice(0, 300),
                  author: item.author.displayName,
                  createdAt: item.createdAt.slice(0, 10),
                })),
              },
            };
          },
        ),
    }),
    createPrayerRequest: tool({
      description:
        'Create a prayer request on behalf of the user; every member is notified. Requires confirmation by the user before it runs.',
      inputSchema: createPrayerRequestInputSchema,
      execute: (input, { toolCallId }) =>
        runner.mutate(PRAYERS_TOOL_META.createPrayerRequest, toolCallId, async () => {
          const request = await prayerRequestsService.create(
            organizationId,
            createPrayerRequestSchema.parse(input),
            userId,
          );

          return {
            ok: true,
            summary: localized(locale, {
              en: `Prayer request "${request.title}" was created.`,
              uk: `Молитовну потребу «${request.title}» створено.`,
            }),
            links: [prayersLink],
          };
        }),
    }),
  };
}

const DESCRIPTION_EXCERPT_LENGTH = 300;

export function prayersApprovalReasons(runner: AiToolRunner) {
  const { locale } = runner.context;

  return {
    // Every member is notified, so the card shows the text they will read, not only its title.
    createPrayerRequest: (input: z.infer<typeof createPrayerRequestInputSchema>) => {
      const description =
        input.description.length > DESCRIPTION_EXCERPT_LENGTH
          ? `${input.description.slice(0, DESCRIPTION_EXCERPT_LENGTH - 1)}…`
          : input.description;

      return localized(locale, {
        en: `Create the prayer request "${input.title}". All members will be notified.\n${description}`,
        uk: `Створити молитовну потребу «${input.title}». Усі учасники отримають сповіщення.\n${description}`,
      });
    },
  };
}
