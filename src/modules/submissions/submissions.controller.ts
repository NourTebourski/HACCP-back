import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/user.entity';

@ApiTags('Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Post()
  @Roles(Role.WORKER, Role.OWNER)
  @ApiOperation({ summary: 'Submit a HACCP checklist' })
  create(@Body() dto: CreateSubmissionDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'List submissions (org-scoped for owner)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'templateId', required: false })
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('templateId') templateId?: string,
  ) {
    return this.service.findAll(user, page, limit, templateId);
  }

  @Get('today-status')
  @Roles(Role.OWNER, Role.WORKER)
  @ApiOperation({ summary: 'Get today checklist completion status for organization' })
  getTodayStatus(@CurrentUser() user: User) {
    return this.service.getTodayStatus(user);
  }

  @Get('overdue')
  @Roles(Role.OWNER, Role.WORKER)
  @ApiOperation({ summary: 'Get overdue daily checklists for organization' })
  getOverdue(@CurrentUser() user: User) {
    return this.service.getOverdue(user);
  }

  @Get('history/:templateId')
  @Roles(Role.SUPER_ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get submission history for a template' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  history(
    @CurrentUser() user: User,
    @Param('templateId') templateId: string,
    @Query('days') days?: number,
  ) {
    return this.service.history(user, templateId, days);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.WORKER)
  @ApiOperation({ summary: 'Get submission by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user);
  }
}
