import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/organization.entity';
import { Submission } from '../submissions/submission.entity';
import { Template } from '../templates/template.entity';
import { User } from '../users/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Submission, Template, User]),
    NotificationsModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
