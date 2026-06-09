import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { apiEnvSchema } from '@churchflow/shared';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { WebsitesModule } from './modules/websites/websites.module';
import { PagesModule } from './modules/pages/pages.module';
import { MediaModule } from './modules/media/media.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => apiEnvSchema.parse(env)
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120
      }
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    MembershipsModule,
    WebsitesModule,
    PagesModule,
    MediaModule,
    HealthModule
  ]
})
export class AppModule {}
