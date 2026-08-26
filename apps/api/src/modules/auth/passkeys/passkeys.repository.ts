import { Injectable } from '@nestjs/common';
import type { WebAuthnChallengeType } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { LOGIN_STATE_SELECT, toLoginUserState, type LoginUserState } from '../login-state';

export interface PasskeyRecord {
  id: string;
  label: string | null;
  credentialId: string;
  transports: string[];
  backedUp: boolean | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface PasskeyCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  signCount: number;
  transports: string[];
}

export interface CreatePasskeyInput {
  userId: string;
  credentialId: string;
  publicKey: string;
  signCount: number;
  transports: string[];
  aaguid: string;
  backedUp: boolean;
  label?: string;
}

const PASSKEY_SELECT = {
  id: true,
  label: true,
  credentialId: true,
  transports: true,
  backedUp: true,
  lastUsedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class PasskeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createChallenge(input: {
    challengeHash: string;
    type: WebAuthnChallengeType;
    expiresAt: Date;
    userId?: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Challenges are short-lived and single-use, so spent ones are cleared as new ones
      // arrive rather than left for a scheduled job.
      await tx.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await tx.webAuthnChallenge.create({
        data: {
          challengeHash: input.challengeHash,
          type: input.type,
          expiresAt: input.expiresAt,
          ...(input.userId ? { userId: input.userId } : {}),
        },
      });
    });
  }

  // Consuming and checking are one step: a challenge that is accepted twice is a replay.
  async consumeChallenge(
    challengeHash: string,
    type: WebAuthnChallengeType,
    userId?: string,
  ): Promise<boolean> {
    const now = new Date();
    const consumed = await this.prisma.webAuthnChallenge.updateMany({
      where: {
        challengeHash,
        type,
        consumedAt: null,
        expiresAt: { gt: now },
        ...(userId ? { userId } : {}),
      },
      data: { consumedAt: now },
    });

    return consumed.count === 1;
  }

  async listForUser(userId: string): Promise<PasskeyRecord[]> {
    const passkeys = await this.prisma.authAccount.findMany({
      where: { userId, provider: 'passkey', deletedAt: null },
      select: PASSKEY_SELECT,
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return passkeys.map(toPasskeyRecord);
  }

  async listCredentialsForUser(
    userId: string,
  ): Promise<Array<{ credentialId: string; transports: string[] }>> {
    const passkeys = await this.prisma.authAccount.findMany({
      where: { userId, provider: 'passkey', deletedAt: null, credentialId: { not: null } },
      select: { credentialId: true, transports: true },
    });

    return passkeys.flatMap((passkey) =>
      passkey.credentialId
        ? [{ credentialId: passkey.credentialId, transports: passkey.transports }]
        : [],
    );
  }

  async findCredential(credentialId: string): Promise<PasskeyCredential | null> {
    const passkey = await this.prisma.authAccount.findFirst({
      where: {
        provider: 'passkey',
        credentialId,
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        credentialId: true,
        publicKey: true,
        signCount: true,
        transports: true,
      },
    });

    if (!passkey?.credentialId || !passkey.publicKey) {
      return null;
    }

    return {
      id: passkey.id,
      userId: passkey.userId,
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      signCount: passkey.signCount,
      transports: passkey.transports,
    };
  }

  async createPasskey(input: CreatePasskeyInput): Promise<PasskeyRecord> {
    const passkey = await this.prisma.authAccount.create({
      data: {
        userId: input.userId,
        provider: 'passkey',
        providerAccountId: input.credentialId,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        signCount: input.signCount,
        transports: input.transports,
        aaguid: input.aaguid,
        backedUp: input.backedUp,
        lastUsedAt: new Date(),
        ...(input.label ? { label: input.label } : {}),
      },
      select: PASSKEY_SELECT,
    });

    return toPasskeyRecord(passkey);
  }

  async recordAuthentication(id: string, signCount: number, backedUp: boolean): Promise<void> {
    await this.prisma.authAccount.update({
      where: { id },
      data: { signCount, backedUp, lastUsedAt: new Date() },
    });
  }

  async rename(id: string, userId: string, label: string): Promise<PasskeyRecord | null> {
    const updated = await this.prisma.authAccount.updateMany({
      where: { id, userId, provider: 'passkey', deletedAt: null },
      data: { label },
    });

    if (updated.count === 0) {
      return null;
    }

    const passkey = await this.prisma.authAccount.findUnique({
      where: { id },
      select: PASSKEY_SELECT,
    });

    return passkey ? toPasskeyRecord(passkey) : null;
  }

  async countSignInMethods(userId: string): Promise<number> {
    return this.prisma.authAccount.count({ where: { userId, deletedAt: null } });
  }

  // Removed outright rather than soft-deleted: the unique index on the credential would
  // otherwise block the owner from registering the same authenticator again.
  async deletePasskey(id: string, userId: string): Promise<boolean> {
    const deleted = await this.prisma.authAccount.deleteMany({
      where: { id, userId, provider: 'passkey' },
    });

    return deleted.count > 0;
  }

  async findLoginState(userId: string): Promise<LoginUserState | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: LOGIN_STATE_SELECT,
    });

    return user ? toLoginUserState(user) : null;
  }
}

function toPasskeyRecord(passkey: {
  id: string;
  label: string | null;
  credentialId: string | null;
  transports: string[];
  backedUp: boolean | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}): PasskeyRecord {
  return {
    id: passkey.id,
    label: passkey.label,
    credentialId: passkey.credentialId ?? '',
    transports: passkey.transports,
    backedUp: passkey.backedUp,
    lastUsedAt: passkey.lastUsedAt,
    createdAt: passkey.createdAt,
  };
}
