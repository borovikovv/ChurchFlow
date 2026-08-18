import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OrganizationRole } from '@churchflow/db';
import type {
  ArchivePrayerRequestInput,
  CreatePrayerRequestInput,
  ListPrayerRequestsQuery,
  PrayerRequestItem,
  PrayerRequestsPayload,
  UpdatePrayerRequestInput,
} from '@churchflow/shared';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PrayerRequestsRepository,
  type PrayerRequestActor,
  type PrayerRequestRecord,
} from './repositories/prayer-requests.repository';

@Injectable()
export class PrayerRequestsService {
  private readonly logger = new Logger(PrayerRequestsService.name);

  constructor(
    private readonly prayerRequestsRepository: PrayerRequestsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
    query: ListPrayerRequestsQuery,
  ): Promise<PrayerRequestsPayload> {
    const actor = await this.requireActorMembership(organizationId, actorUserId);
    const page = await this.prayerRequestsRepository.listForOrganization({
      organizationId,
      actor,
      tab: query.tab,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      actorRole: actor.role,
      actorMembershipId: actor.id,
      tab: query.tab,
      items: page.items.map((request) => requestToItem(request, actor)),
      counts: page.counts,
      pagination: {
        page: page.page,
        pageSize: query.pageSize,
        total: page.total,
        pageCount: Math.max(1, Math.ceil(page.total / query.pageSize)),
      },
    };
  }

  async create(
    organizationId: string,
    input: CreatePrayerRequestInput,
    actorUserId: string,
  ): Promise<PrayerRequestItem> {
    const actor = await this.requireActorMembership(organizationId, actorUserId);
    const request = await this.prayerRequestsRepository.create({
      organizationId,
      actorUserId,
      actor,
      request: input,
    });
    await this.tryNotifyManagersAboutCreatedRequest(organizationId, actorUserId, request);

    return requestToItem(request, actor);
  }

  async update(
    organizationId: string,
    requestId: string,
    input: UpdatePrayerRequestInput,
    actorUserId: string,
  ): Promise<PrayerRequestItem> {
    const actor = await this.requireActorMembership(organizationId, actorUserId);
    const request = await this.prayerRequestsRepository.update({
      organizationId,
      requestId,
      actorUserId,
      actor,
      request: input,
    });
    if (!request) throw new NotFoundException('Prayer request was not found');

    return requestToItem(request, actor);
  }

  async archive(
    organizationId: string,
    requestId: string,
    input: ArchivePrayerRequestInput,
    actorUserId: string,
  ): Promise<PrayerRequestItem> {
    const actor = await this.requireActorMembership(organizationId, actorUserId);
    const request = await this.prayerRequestsRepository.archive({
      organizationId,
      requestId,
      actorUserId,
      actor,
      request: input,
    });
    if (!request) throw new NotFoundException('Prayer request was not found');

    return requestToItem(request, actor);
  }

  async restore(
    organizationId: string,
    requestId: string,
    actorUserId: string,
  ): Promise<PrayerRequestItem> {
    const actor = await this.requireActorMembership(organizationId, actorUserId);
    const request = await this.prayerRequestsRepository.restore({
      organizationId,
      requestId,
      actorUserId,
      actor,
    });
    if (!request) throw new NotFoundException('Prayer request was not found');

    return requestToItem(request, actor);
  }

  async delete(organizationId: string, requestId: string, actorUserId: string) {
    const actor = await this.requireActorMembership(organizationId, actorUserId);
    const request = await this.prayerRequestsRepository.softDelete({
      organizationId,
      requestId,
      actorUserId,
      actor,
    });
    if (!request) throw new NotFoundException('Prayer request was not found');

    return request;
  }

  private async requireActorMembership(
    organizationId: string,
    actorUserId: string,
  ): Promise<PrayerRequestActor> {
    const actor = await this.prayerRequestsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!actor) {
      throw new ForbiddenException('Active organization membership is required');
    }

    return actor;
  }

  private async tryNotifyManagersAboutCreatedRequest(
    organizationId: string,
    actorUserId: string,
    request: PrayerRequestRecord,
  ): Promise<void> {
    try {
      const recipientMembershipIds =
        await this.prayerRequestsRepository.listManagerMembershipIds(organizationId);
      await this.notificationsService.createPrayerRequestCreatedNotifications({
        organizationId,
        actorUserId,
        recipientMembershipIds,
        type: 'PRAYER_REQUEST_CREATED',
        preferenceKey: 'organizationUpdatesEnabled',
        title: 'New prayer request',
        body: `${authorDisplayName(request)} asked for prayer: ${request.title}`,
        url: `/dashboard/${organizationId}/prayer-requests`,
        entityType: 'PrayerRequest',
        entityId: request.id,
        dedupeKey: `prayer-request-created:${request.id}`,
        adminOnly: true,
      });
    } catch (error: unknown) {
      this.logger.warn({
        event: 'Prayer request manager notification failed',
        organizationId,
        prayerRequestId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function requestToItem(request: PrayerRequestRecord, actor: PrayerRequestActor): PrayerRequestItem {
  const canManage = isManagerRole(actor.role);
  const isAuthor = request.authorMembershipId === actor.id;
  const canMutate = canManage || isAuthor;

  return {
    id: request.id,
    organizationId: request.organizationId,
    title: request.title,
    description: request.description,
    archiveReason: request.archiveReason,
    author: {
      membershipId: request.authorMembershipId,
      userId: request.authorUserId,
      displayName: authorDisplayName(request),
    },
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    archivedAt: request.archivedAt?.toISOString() ?? null,
    canEdit: canMutate,
    canDelete: canMutate,
    canArchive: canMutate && request.archivedAt === null,
    canRestore: canMutate && request.archivedAt !== null,
  };
}

function authorDisplayName(request: PrayerRequestRecord): string {
  return (
    request.authorMembership?.profile?.displayName ??
    request.authorMembership?.user?.displayName ??
    request.authorMembership?.user?.email ??
    request.author?.displayName ??
    request.author?.email ??
    'Member'
  );
}

function isManagerRole(role: OrganizationRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
