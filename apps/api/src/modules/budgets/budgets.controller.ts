import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../../common/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { BudgetsService } from './budgets.service';
import {
  CreateBudgetCategoryDto,
  CreateBudgetMonthDto,
  ListBudgetQueryDto,
  UpdateBudgetCategoryDto,
  UpdateBudgetEntryDto,
  UpdateBudgetEntryNoteDto,
} from './dto/budget.dto';

@Controller('organizations/:organizationId/budget')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListBudgetQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.list(organizationId, query.year, this.actorUserId(request));
  }

  @Post('months')
  createMonth(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateBudgetMonthDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.createMonth(organizationId, body, this.actorUserId(request));
  }

  @Post('categories')
  createCategory(
    @Param('organizationId') organizationId: string,
    @Body() body: CreateBudgetCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.createCategory(organizationId, body, this.actorUserId(request));
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('organizationId') organizationId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateBudgetCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.updateCategory(
      organizationId,
      categoryId,
      body,
      this.actorUserId(request),
    );
  }

  @Delete('categories/:categoryId')
  deleteCategory(
    @Param('organizationId') organizationId: string,
    @Param('categoryId') categoryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.deleteCategory(
      organizationId,
      categoryId,
      this.actorUserId(request),
    );
  }

  @Delete('months/:monthId')
  deleteMonth(
    @Param('organizationId') organizationId: string,
    @Param('monthId') monthId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.deleteMonth(organizationId, monthId, this.actorUserId(request));
  }

  @Post('months/:monthId/rows')
  addMonthRow(
    @Param('organizationId') organizationId: string,
    @Param('monthId') monthId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.addMonthRow(organizationId, monthId, this.actorUserId(request));
  }

  @Delete('months/:monthId/rows/last')
  removeLastMonthRow(
    @Param('organizationId') organizationId: string,
    @Param('monthId') monthId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.removeLastMonthRow(
      organizationId,
      monthId,
      this.actorUserId(request),
    );
  }

  @Patch('months/:monthId/rows/:rowIndex/categories/:categoryId')
  updateEntry(
    @Param('organizationId') organizationId: string,
    @Param('monthId') monthId: string,
    @Param('rowIndex') rowIndex: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateBudgetEntryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.updateEntry(
      organizationId,
      monthId,
      categoryId,
      Number(rowIndex),
      body,
      this.actorUserId(request),
    );
  }

  @Patch('months/:monthId/rows/:rowIndex/categories/:categoryId/notes/:field')
  updateEntryNote(
    @Param('organizationId') organizationId: string,
    @Param('monthId') monthId: string,
    @Param('rowIndex') rowIndex: string,
    @Param('categoryId') categoryId: string,
    @Param('field') field: string,
    @Body() body: UpdateBudgetEntryNoteDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.updateEntryNote(
      organizationId,
      monthId,
      categoryId,
      Number(rowIndex),
      field,
      body,
      this.actorUserId(request),
    );
  }

  private actorUserId(request: AuthenticatedRequest): string {
    const userId = request.auth?.sub;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
