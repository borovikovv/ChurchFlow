import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ScheduledJobLockService {
  private readonly logger = new Logger(ScheduledJobLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runOnce<T>(
    name: string,
    job: () => Promise<T>,
    options: { lockTtlMs?: number } = {},
  ): Promise<{ skipped: true } | { skipped: false; result: T }> {
    const ownerId = randomUUID();
    const acquired = await this.acquire(name, ownerId, options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS);

    if (!acquired) {
      this.logger.debug({ event: 'Scheduled job skipped because lock is held', job: name });
      return { skipped: true };
    }

    try {
      const result = await job();
      return { skipped: false, result };
    } finally {
      await this.release(name, ownerId);
    }
  }

  private async acquire(name: string, ownerId: string, ttlMs: number): Promise<boolean> {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + ttlMs);

    try {
      await this.prisma.scheduledJobLock.create({
        data: { name, ownerId, lockedAt: now, lockedUntil },
      });
      return true;
    } catch (error: unknown) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const updated = await this.prisma.scheduledJobLock.updateMany({
      where: {
        name,
        lockedUntil: { lt: now },
      },
      data: {
        ownerId,
        lockedAt: now,
        lockedUntil,
      },
    });

    return updated.count === 1;
  }

  private async release(name: string, ownerId: string): Promise<void> {
    await this.prisma.scheduledJobLock.updateMany({
      where: { name, ownerId },
      data: { lockedUntil: new Date() },
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
