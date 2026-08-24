import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@churchflow/db';
import { RequestContextService } from '../common/context/request-context.service';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Позначає, що ми вже всередині інтерактивної транзакції. Хук на запитах
  // спрацьовує і там теж, а відкривати транзакцію в транзакції не можна.
  private readonly insideTransaction = new AsyncLocalStorage<true>();

  constructor(
    configService: ConfigService,
    private readonly context: RequestContextService,
  ) {
    super({
      adapter: new PrismaPg(
        configService.get<string>('DATABASE_APP_URL') ??
          configService.getOrThrow<string>('DATABASE_URL'),
      ),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  override $transaction<R>(
    fn: (client: TransactionClient) => Promise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<R>;
  override $transaction<P extends Prisma.PrismaPromise<unknown>[]>(
    operations: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  override $transaction(operationsOrFn: unknown, options?: unknown): Promise<unknown> {
    if (typeof operationsOrFn !== 'function') {
      return super.$transaction(
        operationsOrFn as Prisma.PrismaPromise<unknown>[],
        options as { isolationLevel?: Prisma.TransactionIsolationLevel },
      );
    }

    const fn = operationsOrFn as (client: TransactionClient) => Promise<unknown>;
    return super.$transaction(async (tx) => {
      await this.applyTenantContext(tx);
      return this.insideTransaction.run(true, () => fn(tx));
    }, options as { maxWait?: number; timeout?: number });
  }

  // Порожній рядок замість NULL: current_setting поверне '', а не помилку,
  // і політики трактують це як «користувача немає».
  applyTenantContext(tx: TransactionClient): Promise<unknown> {
    return tx.$executeRaw`
      SELECT set_config('app.current_user_id', ${this.context.userId ?? ''}, TRUE),
             set_config('app.system', ${this.context.isSystem ? 'on' : ''}, TRUE)
    `;
  }

  // Те саме, але як незавершений PrismaPromise — щоб його можна було покласти
  // в батч разом із самим запитом.
  tenantContextStatement(): Prisma.PrismaPromise<unknown> {
    return this.$executeRaw`
      SELECT set_config('app.current_user_id', ${this.context.userId ?? ''}, TRUE),
             set_config('app.system', ${this.context.isSystem ? 'on' : ''}, TRUE)
    `;
  }

  get inTransaction(): boolean {
    return this.insideTransaction.getStore() === true;
  }
}
