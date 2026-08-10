import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { MembershipsService } from './memberships.service';
import { UpdateMembershipRoleDto } from './dto/update-membership-role.dto';
import { CreateManualMemberDto } from './dto/create-manual-member.dto';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { ListMembershipsQueryDto } from './dto/list-memberships-query.dto';
import { CreateMemberRelationshipDto } from './dto/create-member-relationship.dto';

interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('organizations/:organizationId/memberships')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  async list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListMembershipsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.listForOrganization(
      organizationId,
      this.getActorUserId(request),
      query.access,
      query.type,
      query.search,
      query.ministries,
      query.page,
      query.pageSize,
      query.membershipId,
    );
  }

  @Post('manual')
  async createManual(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateManualMemberDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.createManualMember(
      organizationId,
      body,
      this.getActorUserId(request),
    );
  }

  @Post('import-csv')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }))
  async importCsv(
    @Param('organizationId') organizationId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (!isCsvFile(file)) {
      throw new BadRequestException('Upload a .csv file');
    }

    return this.membershipsService.importMembersCsv(
      organizationId,
      file.buffer.toString('utf8'),
      this.getActorUserId(request),
    );
  }

  @Patch(':membershipId/profile')
  async updateProfile(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMemberProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.updateProfile(
      organizationId,
      membershipId,
      body,
      this.getActorUserId(request),
    );
  }

  @Patch(':membershipId/role')
  async updateRole(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMembershipRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.updateRole(
      organizationId,
      membershipId,
      body.role,
      this.getActorUserId(request),
    );
  }

  @Get(':membershipId/relationships')
  listRelationships(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.listRelationships(
      organizationId,
      membershipId,
      this.getActorUserId(request),
    );
  }

  @Post(':membershipId/relationships')
  createRelationship(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: CreateMemberRelationshipDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.createRelationship(
      organizationId,
      membershipId,
      body,
      this.getActorUserId(request),
    );
  }

  @Delete('relationships/:relationshipId')
  deleteRelationship(
    @Param('organizationId') organizationId: string,
    @Param('relationshipId') relationshipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.deleteRelationship(
      organizationId,
      relationshipId,
      this.getActorUserId(request),
    );
  }

  @Post(':membershipId/remove')
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.membershipsService.removeMember(
      organizationId,
      membershipId,
      this.getActorUserId(request),
    );
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}

function isCsvFile(file: UploadedCsvFile): boolean {
  const filename = file.originalname.toLowerCase();
  return (
    filename.endsWith('.csv') ||
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel'
  );
}
