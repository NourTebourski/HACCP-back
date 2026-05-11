import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Submission, SubmissionStatus } from '../submissions/submission.entity';
import { Template } from '../templates/template.entity';
import { User } from '../users/user.entity';
import { Organization } from '../organizations/organization.entity';
import { Frequency } from '../../common/enums/frequency.enum';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
    @InjectRepository(Template) private templateRepo: Repository<Template>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
  ) {}

  async getOwnerDashboard(organizationId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Today's submissions
    const todaySubmissions = await this.submissionRepo.find({
      where: { organizationId, createdAt: Between(startOfDay, endOfDay) },
      relations: ['template'],
    });

    // Daily templates
    const dailyTemplates = await this.templateRepo.find({
      where: { frequency: Frequency.DAILY, isActive: true },
    });

    const submittedTodayIds = new Set(todaySubmissions.map((s) => s.templateId));
    const overdueCount = dailyTemplates.filter((t) => !submittedTodayIds.has(t.id)).length;

    // Compliance today
    const complianceToday = dailyTemplates.length > 0
      ? Math.round((submittedTodayIds.size / dailyTemplates.length) * 100)
      : 100;

    // Issues today (critical/warning)
    const issuesCount = todaySubmissions.filter(
      (s) => s.status === SubmissionStatus.CRITICAL || s.status === SubmissionStatus.WARNING,
    ).length;

    // Weekly stats (last 7 days)
    const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklySubmissions = await this.submissionRepo.find({
      where: { organizationId, createdAt: Between(weekAgo, endOfDay) },
    });

    const weeklyStats = this.groupByDay(weeklySubmissions, 7);

    // Worker activity (last 7 days)
    const workerActivity = await this.submissionRepo
      .createQueryBuilder('sub')
      .select('sub.submittedById', 'userId')
      .addSelect('user.firstName', 'firstName')
      .addSelect('user.lastName', 'lastName')
      .addSelect('COUNT(sub.id)', 'submissionCount')
      .leftJoin('sub.submittedBy', 'user')
      .where('sub.organizationId = :organizationId', { organizationId })
      .andWhere('sub.createdAt >= :since', { since: weekAgo })
      .groupBy('sub.submittedById')
      .addGroupBy('user.firstName')
      .addGroupBy('user.lastName')
      .orderBy('submissionCount', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      organizationId,
      today: {
        date: this.localDateStr(today),
        submissionsCount: todaySubmissions.length,
        compliancePercent: complianceToday,
        overdueCount,
        issuesCount,
      },
      weeklyStats,
      workerActivity,
    };
  }

  async getSuperAdminDashboard() {
    const [totalOrgs, totalUsers, totalSubmissions] = await Promise.all([
      this.orgRepo.count({ where: { isActive: true } }),
      this.userRepo.count({ where: { isActive: true } }),
      this.submissionRepo.count(),
    ]);

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const submissionsToday = await this.submissionRepo.count({
      where: { createdAt: Between(startOfDay, endOfDay) },
    });

    // Per-org compliance (today)
    const orgs = await this.orgRepo.find({ where: { isActive: true } });
    const dailyTemplateCount = await this.templateRepo.count({
      where: { frequency: Frequency.DAILY, isActive: true },
    });

    const orgComplianceData = await Promise.all(
      orgs.map(async (org) => {
        const submitted = await this.submissionRepo
          .createQueryBuilder('sub')
          .select('COUNT(DISTINCT sub.templateId)', 'count')
          .where('sub.organizationId = :orgId', { orgId: org.id })
          .andWhere('sub.createdAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
          .getRawOne<{ count: string }>();

        const submittedCount = parseInt(submitted?.count || '0', 10);
        const compliance = dailyTemplateCount > 0
          ? Math.round((submittedCount / dailyTemplateCount) * 100)
          : 100;

        return {
          id: org.id,
          name: org.name,
          compliance,
          submissionsToday: submittedCount,
        };
      }),
    );

    // Critical issues last 24h
    const criticalIssues = await this.submissionRepo.count({
      where: { status: SubmissionStatus.CRITICAL, createdAt: Between(startOfDay, endOfDay) },
    });

    return {
      totals: { organizations: totalOrgs, users: totalUsers, submissions: totalSubmissions },
      today: {
        date: this.localDateStr(today),
        submissionsCount: submissionsToday,
        criticalIssues,
      },
      orgCompliance: orgComplianceData,
    };
  }

  private localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private groupByDay(submissions: Submission[], days: number) {
    const result: { date: string; count: number; issues: number }[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dateStr = this.localDateStr(d);
      const daySubmissions = submissions.filter(
        (s) => this.localDateStr(new Date(s.createdAt)) === dateStr,
      );
      result.push({
        date: dateStr,
        count: daySubmissions.length,
        issues: daySubmissions.filter(
          (s) => s.status === SubmissionStatus.CRITICAL || s.status === SubmissionStatus.WARNING,
        ).length,
      });
    }

    return result;
  }
}
