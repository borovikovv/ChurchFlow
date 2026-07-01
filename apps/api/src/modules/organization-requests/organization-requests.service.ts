import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type {
  ApproveOrganizationRequestInput,
  CreateOrganizationRequestInput,
  RejectOrganizationRequestInput,
} from '@churchflow/shared';
import { slugSchema } from '@churchflow/shared';
import { EmailService } from '../email/email.service';
import { OrganizationRequestsRepository } from './repositories/organization-requests.repository';

const ORGANIZATION_REQUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UKRAINIAN_TRANSLITERATION: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'yu',
  я: 'ya',
};

export function generateOrganizationSlug(value: string, fallbackSeed: string): string {
  const transliterated = Array.from(value.trim().toLowerCase())
    .map((character) => {
      if (/[a-z0-9]/.test(character)) {
        return character;
      }
      return UKRAINIAN_TRANSLITERATION[character] ?? '-';
    })
    .join('');
  const generated = transliterated
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  const fallbackSuffix = fallbackSeed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  const slug = generated || `organization-${fallbackSuffix || 'new'}`;

  return slugSchema.parse(slug);
}

export interface CreatedOrganizationRequest {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  requestedBy: {
    accounts: Array<{
      providerAccountId: string;
    }>;
  } | null;
}

export interface OrganizationRequestForApproval {
  status: string;
  organizationName: string;
  organizationSlug: string | null;
  requestedByUserId: string | null;
}

export interface OrganizationRequestListItem {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactTelegramId: string;
  contactTelegramUsername: string | null;
  status: string;
  createdAt: Date;
}

export interface OrganizationRequestDetail extends OrganizationRequestListItem {
  organizationSlug: string | null;
  contactPhone: string | null;
  message: string | null;
  rejectionReason: string | null;
  requestedByUserId: string | null;
  createdOrganization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface RejectedOrganizationRequest {
  organizationName: string;
  contactEmail: string | null;
}

export interface ApprovedOrganizationRequest {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
  };
}

interface OrganizationRequestsRepositoryPort {
  create(
    input: CreateOrganizationRequestInput,
    requestedByUserId: string,
    staleBefore: Date,
  ): Promise<CreatedOrganizationRequest>;
  expireStaleAndFindPending(
    requestedByUserId: string,
    staleBefore: Date,
  ): Promise<{ id: string } | null>;
  listForRequester(
    requestedByUserId: string,
    staleBefore: Date,
  ): Promise<OrganizationRequestDetail[]>;
  list(status: string | undefined, staleBefore: Date): Promise<OrganizationRequestListItem[]>;
  findById(id: string, staleBefore: Date): Promise<OrganizationRequestDetail | null>;
  findOrganizationBySlug(slug: string): Promise<{ id: string } | null>;
  approve(input: {
    id: string;
    organizationName: string;
    organizationSlug: string;
    actorUserId: string;
    staleBefore: Date;
  }): Promise<ApprovedOrganizationRequest>;
  reject(
    id: string,
    rejectionReason: string,
    actorUserId: string,
    staleBefore: Date,
  ): Promise<RejectedOrganizationRequest | null>;
}

@Injectable()
export class OrganizationRequestsService {
  private readonly logger = new Logger(OrganizationRequestsService.name);

  constructor(
    @Inject(OrganizationRequestsRepository)
    private readonly organizationRequestsRepository: OrganizationRequestsRepositoryPort,
    private readonly emailService: EmailService,
  ) {}

  async create(input: CreateOrganizationRequestInput, requestedByUserId: string) {
    const staleBefore = this.organizationRequestStaleBefore();
    const pending = await this.organizationRequestsRepository.expireStaleAndFindPending(
      requestedByUserId,
      staleBefore,
    );
    if (pending) {
      throw new ConflictException('You already have a pending organization request');
    }

    let request: CreatedOrganizationRequest;
    try {
      request = await this.organizationRequestsRepository.create(
        input,
        requestedByUserId,
        staleBefore,
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_REQUESTER_INACTIVE') {
        throw new UnauthorizedException('Organization request requester is no longer active');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You already have a pending organization request');
      }
      throw error;
    }
    const requestedTelegramAccountId: string =
      request.requestedBy === null
        ? 'linked Telegram account'
        : (request.requestedBy.accounts[0]?.providerAccountId ?? 'linked Telegram account');

    const notificationSent = await this.trySendEmail(() =>
      this.emailService.sendOrganizationRequestAdminEmail({
        requestId: request.id,
        organizationName: request.organizationName,
        contactName: request.contactName,
        contactEmail: request.contactEmail,
        contactTelegramId: requestedTelegramAccountId,
        contactTelegramUsername: null,
        contactPhone: request.contactPhone,
        message: request.message,
      }),
    );

    return { ...request, notificationSent };
  }

  async listMine(requestedByUserId: string) {
    return this.organizationRequestsRepository.listForRequester(
      requestedByUserId,
      this.organizationRequestStaleBefore(),
    );
  }

  async list(status?: string) {
    return this.organizationRequestsRepository.list(status, this.organizationRequestStaleBefore());
  }

  async get(id: string) {
    const request = await this.organizationRequestsRepository.findById(
      id,
      this.organizationRequestStaleBefore(),
    );
    if (!request) {
      throw new NotFoundException('Organization request was not found');
    }

    return request;
  }

  async approve(id: string, input: ApproveOrganizationRequestInput, actorUserId: string) {
    const staleBefore = this.organizationRequestStaleBefore();
    const request = await this.organizationRequestsRepository.findById(id, staleBefore);
    if (!request) {
      throw new NotFoundException('Organization request was not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException('Only pending organization requests can be approved');
    }

    const organizationName = input.organizationName ?? request.organizationName;
    const organizationSlug =
      input.organizationSlug ??
      request.organizationSlug ??
      generateOrganizationSlug(organizationName, id);
    const existingOrganization =
      await this.organizationRequestsRepository.findOrganizationBySlug(organizationSlug);
    if (existingOrganization) {
      throw new ConflictException('Organization slug is already in use');
    }

    const result: ApprovedOrganizationRequest = await this.approveRequestTransaction({
      id,
      organizationName,
      organizationSlug,
      actorUserId,
      staleBefore,
    });
    const contactEmail = request.contactEmail;
    const notificationSent = contactEmail
      ? await this.trySendEmail(() =>
          this.emailService.sendOrganizationRequestApprovedEmail({
            email: contactEmail,
            organizationName: result.organization.name,
            organizationId: result.organization.id,
          }),
        )
      : false;

    return { ...result, notificationSent };
  }

  private async approveRequestTransaction(input: {
    id: string;
    organizationName: string;
    organizationSlug: string;
    actorUserId: string;
    staleBefore: Date;
  }): Promise<ApprovedOrganizationRequest> {
    try {
      return await this.organizationRequestsRepository.approve(input);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_NOT_PENDING') {
        throw new ConflictException('Only pending organization requests can be approved');
      }

      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_MISSING_REQUESTER') {
        throw new ConflictException('Organization request is missing authenticated requester');
      }

      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_REQUESTER_INACTIVE') {
        throw new ConflictException('Organization request requester is no longer active');
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Organization slug is already in use');
      }

      throw error;
    }
  }

  async reject(id: string, input: RejectOrganizationRequestInput, actorUserId: string) {
    const request = await this.organizationRequestsRepository.reject(
      id,
      input.rejectionReason,
      actorUserId,
      this.organizationRequestStaleBefore(),
    );
    if (!request) {
      throw new NotFoundException('Pending organization request was not found');
    }

    let notificationSent = false;
    if (request.contactEmail) {
      const contactEmail = request.contactEmail;
      notificationSent = await this.trySendEmail(() =>
        this.emailService.sendOrganizationRequestRejectedEmail({
          email: contactEmail,
          organizationName: request.organizationName,
          rejectionReason: input.rejectionReason,
        }),
      );
    }

    return { ...request, notificationSent };
  }

  private organizationRequestStaleBefore(): Date {
    return new Date(Date.now() - ORGANIZATION_REQUEST_TTL_MS);
  }

  private async trySendEmail(send: () => Promise<void>): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error: unknown) {
      this.logger.error(
        'Transactional email delivery failed after the business operation was committed',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
