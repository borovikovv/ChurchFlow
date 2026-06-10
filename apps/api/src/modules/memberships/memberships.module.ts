import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './repositories/memberships.repository';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [InvitationsModule],
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipsRepository]
})
export class MembershipsModule {}
