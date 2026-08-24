import type { PrismaService } from './prisma.service';

// Одиночні запити виконуються поза транзакцією, а set_config живе рівно стільки,
// скільки транзакція. Тому кожен такий запит батчиться разом із виставленням
// контексту: обидва стейтменти йдуть одним з'єднанням і однією транзакцією.
// Усередині інтерактивної транзакції контекст уже виставив $transaction.
//
// $extends повертає власний тип клієнта, який структурно не збігається з
// PrismaService, хоча поведінково є його надмножиною: усі делегати моделей і
// перевизначений $transaction на місці. Виразити це системою типів не виходить,
// тож звуження робиться тут один раз, на межі складання застосунку, щоб решта
// коду продовжувала бачити звичайний PrismaService.
export function withTenantContext(client: PrismaService): PrismaService {
  const extended = client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          if (client.inTransaction) {
            return query(args);
          }
          const [, result] = await client.$transaction([
            client.tenantContextStatement(),
            query(args),
          ]);
          return result;
        },
      },
    },
  });

  return extended as unknown as PrismaService;
}
