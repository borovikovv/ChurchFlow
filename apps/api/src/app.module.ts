import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { resolve } from 'node:path';
import { apiEnvSchema } from '@churchflow/shared';
import { PrismaModule } from './prisma/prisma.module';
import { UserLocaleModule } from './common/locale/user-locale.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { OrganizationRequestsModule } from './modules/organization-requests/organization-requests.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { GroupsModule } from './modules/groups/groups.module';
import { WebsitesModule } from './modules/websites/websites.module';
import { PagesModule } from './modules/pages/pages.module';
import { MediaModule } from './modules/media/media.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { PlatformAdminBootstrapModule } from './modules/platform-admin-bootstrap/platform-admin-bootstrap.module';
import { MembershipClaimsModule } from './modules/membership-claims/membership-claims.module';
import { CalendarEventsModule } from './modules/calendar-events/calendar-events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ScheduledJobsModule } from './modules/scheduled-jobs/scheduled-jobs.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { PrayerRequestsModule } from './modules/prayer-requests/prayer-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '../.env'),
      ignoreEnvFile: process.env['NODE_ENV'] === 'production',
      validate: (env) => apiEnvSchema.parse(env),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    UserLocaleModule,
    EmailModule,
    AuditModule,
    PlatformAdminBootstrapModule,
    AuthModule,
    UsersModule,
    InvitationsModule,
    OrganizationRequestsModule,
    OrganizationsModule,
    MembershipsModule,
    GroupsModule,
    MembershipClaimsModule,
    CalendarEventsModule,
    PrayerRequestsModule,
    BudgetsModule,
    ScheduledJobsModule,
    NotificationsModule,
    TelegramBotModule,
    WebsitesModule,
    PagesModule,
    MediaModule,
    HealthModule,
  ],
})
export class AppModule {}
