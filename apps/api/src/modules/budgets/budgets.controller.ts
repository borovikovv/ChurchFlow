import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../../common/guards/session-auth.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { BudgetsService } from './budgets.service';
import {
  BudgetExchangeDto,
  CreateBudgetCategoryDto,
  CreateBudgetMonthDto,
  ListBudgetQueryDto,
  UpdateBudgetBaseCurrencyDto,
  UpdateBudgetCategoryDto,
  UpdateBudgetEntryDto,
  UpdateBudgetEntryNoteDto,
  UpdateBudgetOpeningBalanceDto,
} from './dto/budget.dto';

@Controller('organizations/:organizationId/budget')
@UseGuards(SessionAuthGuard, OrganizationAccessGuard)
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

  @Put('base-currency')
  updateBaseCurrency(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateBudgetBaseCurrencyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.updateBaseCurrency(organizationId, body, this.actorUserId(request));
  }

  @Put('opening-balance')
  updateOpeningBalance(
    @Param('organizationId') organizationId: string,
    @Body() body: UpdateBudgetOpeningBalanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.updateOpeningBalance(
      organizationId,
      body,
      this.actorUserId(request),
    );
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

  @Post('months/:monthId/exchanges')
  createExchange(
    @Param('organizationId') organizationId: string,
    @Param('monthId') monthId: string,
    @Body() body: BudgetExchangeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.createExchange(
      organizationId,
      monthId,
      body,
      this.actorUserId(request),
    );
  }

  @Put('exchanges/:exchangeId')
  updateExchange(
    @Param('organizationId') organizationId: string,
    @Param('exchangeId') exchangeId: string,
    @Body() body: BudgetExchangeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.updateExchange(
      organizationId,
      exchangeId,
      body,
      this.actorUserId(request),
    );
  }

  @Delete('exchanges/:exchangeId')
  deleteExchange(
    @Param('organizationId') organizationId: string,
    @Param('exchangeId') exchangeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.budgetsService.deleteExchange(
      organizationId,
      exchangeId,
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
    const userId = request.auth?.userId;
    if (!userId) {
      throw new Error('Authenticated request missing auth payload');
    }

    return userId;
  }
}
