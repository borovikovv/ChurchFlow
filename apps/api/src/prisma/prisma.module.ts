import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../common/context/request-context.service';
import { PrismaService } from './prisma.service';
import { withTenantContext } from './tenant-context.extension';

@Global()
@Module({
  providers: [
    RequestContextService,
    {
      provide: PrismaService,
      useFactory: (configService: ConfigService, context: RequestContextService) =>
        withTenantContext(new PrismaService(configService, context)),
      inject: [ConfigService, RequestContextService],
    },
  ],
  exports: [PrismaService, RequestContextService],
})
export class PrismaModule {}
