import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../submissions/submission.entity';
import { Template } from '../templates/template.entity';
import { User } from '../users/user.entity';
import { Organization } from '../organizations/organization.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Template, User, Organization])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
