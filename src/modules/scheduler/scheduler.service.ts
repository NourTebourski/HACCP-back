import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Submission } from '../submissions/submission.entity';
import { Template } from '../templates/template.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { Frequency } from '../../common/enums/frequency.enum';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
    @InjectRepository(Template) private templateRepo: Repository<Template>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { name: 'daily-overdue-check', timeZone: 'Europe/Berlin' })
  async checkOverdueDailyChecklists() {
    this.logger.log('Running daily overdue checklist check...');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const dailyTemplates = await this.templateRepo.find({
      where: { frequency: Frequency.DAILY, isActive: true },
    });

    if (dailyTemplates.length === 0) {
      this.logger.log('No daily templates found, skipping.');
      return;
    }

    const activeOrgs = await this.orgRepo.find({ where: { isActive: true } });

    for (const org of activeOrgs) {
      const todaySubmissions = await this.submissionRepo.find({
        where: { organizationId: org.id, createdAt: Between(startOfDay, endOfDay) },
      });

      const submittedIds = new Set(todaySubmissions.map((s) => s.templateId));
      const overdueTemplates = dailyTemplates.filter((t) => !submittedIds.has(t.id));

      if (overdueTemplates.length === 0) continue;

      // Find owners of this org
      const owners = await this.userRepo.find({
        where: { organizationId: org.id, role: Role.OWNER, isActive: true },
      });

      for (const owner of owners) {
        await this.notificationsService.create({
          userId: owner.id,
          organizationId: org.id,
          type: NotificationType.OVERDUE_CHECKLIST,
          title: 'Checklisten ausstehend',
          message: `${overdueTemplates.length} tägliche Checkliste(n) noch nicht ausgefüllt: ${overdueTemplates.map((t) => t.name).join(', ')}`,
          metadata: {
            overdueTemplateIds: overdueTemplates.map((t) => t.id),
            overdueTemplateNames: overdueTemplates.map((t) => t.name),
          },
        });
      }

      // Emit Socket.IO event to org room
      await this.notificationsService.emitToOrg(org.id, 'checklist:overdue', {
        organizationId: org.id,
        overdueTemplates: overdueTemplates.map((t) => ({ id: t.id, name: t.name })),
        checkedAt: new Date().toISOString(),
      });

      this.logger.log(
        `Org ${org.name}: ${overdueTemplates.length} overdue checklists, notified ${owners.length} owners`,
      );
    }

    this.logger.log('Daily overdue checklist check complete.');
  }
}
