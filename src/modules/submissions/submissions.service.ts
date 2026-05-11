import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Submission } from './submission.entity';
import { Template } from '../templates/template.entity';
import { User } from '../users/user.entity';
import { Role } from '../../common/enums/role.enum';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { validateSubmissionValues } from './helpers/validate-submission.helper';
import { Frequency } from '../../common/enums/frequency.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
    @InjectRepository(Template) private templateRepo: Repository<Template>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateSubmissionDto, user: User) {
    const template = await this.templateRepo.findOne({ where: { id: dto.templateId, isActive: true } });
    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);

    const { status, violations } = validateSubmissionValues(template.fields, dto.values);

    const submission = this.submissionRepo.create({
      templateId: dto.templateId,
      organizationId: user.organizationId,
      submittedById: user.id,
      values: dto.values,
      notes: dto.notes,
      status,
      violations,
    });

    const saved = await this.submissionRepo.save(submission);

    // Fire notifications for critical or warning submissions
    if (status !== 'ok' && user.organizationId) {
      const notifType = status === 'critical' ? NotificationType.CRITICAL_VALUE : NotificationType.WARNING_VALUE;
      const violationSummary = violations.map((v) => v.key).join(', ');
      const title = status === 'critical'
        ? `🚨 Kritischer Wert: ${template.name}`
        : `⚠️ Warnung: ${template.name}`;
      const message = `Eingereicht von ${user.firstName} ${user.lastName}. Felder: ${violationSummary}`;

      // Notify all owners of this organization
      const owners = await this.userRepo.find({
        where: { organizationId: user.organizationId, role: Role.OWNER, isActive: true },
      });

      await Promise.all(
        owners.map((owner) =>
          this.notificationsService.create({
            userId: owner.id,
            organizationId: user.organizationId,
            type: notifType,
            title,
            message,
            metadata: { submissionId: saved.id, templateId: dto.templateId, status, violations },
          }),
        ),
      );
    }

    return saved;
  }

  async findAll(user: User, page = 1, limit = 20, templateId?: string) {
    const qb = this.submissionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.template', 'template')
      .leftJoinAndSelect('sub.submittedBy', 'user')
      .orderBy('sub.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (user.role !== Role.SUPER_ADMIN) {
      qb.where('sub.organizationId = :orgId', { orgId: user.organizationId });
    }

    if (templateId) {
      qb.andWhere('sub.templateId = :templateId', { templateId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, user: User) {
    const sub = await this.submissionRepo.findOne({
      where: { id },
      relations: ['template', 'submittedBy', 'organization'],
    });
    if (!sub) throw new NotFoundException(`Submission ${id} not found`);

    if (user.role !== Role.SUPER_ADMIN && sub.organizationId !== user.organizationId) {
      throw new ForbiddenException('Access denied');
    }

    return sub;
  }

  async getTodayStatus(user: User) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const submissions = await this.submissionRepo.find({
      where: {
        organizationId: user.organizationId,
        createdAt: Between(startOfDay, endOfDay),
      },
      relations: ['template'],
    });

    const dailyTemplates = await this.templateRepo.find({
      where: { frequency: Frequency.DAILY, isActive: true },
    });

    const submittedTemplateIds = new Set(submissions.map((s) => s.templateId));
    const pendingTemplates = dailyTemplates.filter((t) => !submittedTemplateIds.has(t.id));
    const submissionsCount = submissions.filter((s) =>
      dailyTemplates.some((t) => t.id === s.templateId),
    ).length;
    const total = dailyTemplates.length;
    const compliancePercent = total > 0 ? Math.round((submissionsCount / total) * 100) : 0;
    const overdueCount = pendingTemplates.length;
    const issuesCount = submissions.filter((s) => s.status === 'critical' || s.status === 'warning').length;

    return {
      date: (() => { const y = today.getFullYear(); const m = String(today.getMonth()+1).padStart(2,'0'); const d = String(today.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; })(),
      totalDailyTemplates: total,
      submissionsCount,
      compliancePercent,
      overdueCount,
      issuesCount,
      pendingTemplates: pendingTemplates.map((t) => ({ id: t.id, name: t.name })),
      submissions,
    };
  }

  async getOverdue(user: User) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const todaySubmissions = await this.submissionRepo.find({
      where: {
        organizationId: user.organizationId,
        createdAt: Between(startOfDay, new Date()),
      },
    });

    const dailyTemplates = await this.templateRepo.find({
      where: { frequency: Frequency.DAILY, isActive: true },
    });

    const submittedIds = new Set(todaySubmissions.map((s) => s.templateId));
    return dailyTemplates
      .filter((t) => !submittedIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, frequency: t.frequency }));
  }

  async history(user: User, templateId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const qb = this.submissionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.submittedBy', 'user')
      .where('sub.templateId = :templateId', { templateId })
      .andWhere('sub.createdAt >= :since', { since })
      .orderBy('sub.createdAt', 'DESC');

    if (user.role !== Role.SUPER_ADMIN) {
      qb.andWhere('sub.organizationId = :orgId', { orgId: user.organizationId });
    }

    return qb.getMany();
  }
}
