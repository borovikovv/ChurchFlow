import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client/index.js';

const email = (process.env.ADMIN_EMAIL ?? process.env.PLATFORM_ADMIN_EMAIL)?.trim().toLowerCase();
const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Platform Admin';

if (!email) {
  console.error('Set ADMIN_EMAIL or PLATFORM_ADMIN_EMAIL before running bootstrap:admin.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL before running bootstrap:admin.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

try {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      emailVerified: new Date(),
      platformRole: 'SUPER_ADMIN',
      deletedAt: null,
    },
    create: {
      email,
      displayName,
      emailVerified: new Date(),
      platformRole: 'SUPER_ADMIN',
    },
  });

  await prisma.authAccount.upsert({
    where: { provider_providerAccountId: { provider: 'email', providerAccountId: email } },
    update: { userId: user.id, deletedAt: null, lastUsedAt: new Date() },
    create: {
      userId: user.id,
      provider: 'email',
      providerAccountId: email,
      lastUsedAt: new Date(),
    },
  });

  console.log(`Bootstrapped SUPER_ADMIN user ${email}`);
} finally {
  await prisma.$disconnect();
}
