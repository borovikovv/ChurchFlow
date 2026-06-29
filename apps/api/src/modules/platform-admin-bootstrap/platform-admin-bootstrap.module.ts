import { Module } from '@nestjs/common';
import { PlatformAdminBootstrapController } from './platform-admin-bootstrap.controller';
import { PlatformAdminBootstrapRepository } from './platform-admin-bootstrap.repository';
import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service';

@Module({
  controllers: [PlatformAdminBootstrapController],
  providers: [PlatformAdminBootstrapService, PlatformAdminBootstrapRepository],
})
export class PlatformAdminBootstrapModule {}
