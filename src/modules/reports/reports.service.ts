import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Submission, SubmissionStatus } from '../submissions/submission.entity';
import { Template } from '../templates/template.entity';
import { User } from '../users/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
    @InjectRepository(Template) private templateRepo: Repository<Template>,
  ) {}

  async generateMonthlyReport(
    organizationId: string,
    year: number,
    month: number,
    requestingUser: User,
  ) {
    if (
      requestingUser.role !== Role.SUPER_ADMIN &&
      requestingUser.organizationId !== organizationId
    ) {
      return { error: 'Access denied' };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const submissions = await this.submissionRepo.find({
      where: {
        organizationId,
        createdAt: Between(startDate, endDate),
      },
      relations: ['template', 'submittedBy'],
      order: { createdAt: 'ASC' },
    });

    const templates = await this.templateRepo.find({ where: { isActive: true } });

    // Group by template
    const byTemplate = new Map<string, { template: Template; submissions: Submission[] }>();
    for (const t of templates) {
      byTemplate.set(t.id, { template: t, submissions: [] });
    }
    for (const s of submissions) {
      const entry = byTemplate.get(s.templateId);
      if (entry) entry.submissions.push(s);
    }

    const templateStats = [...byTemplate.values()].map(({ template, submissions: subs }) => {
      const okCount = subs.filter((s) => s.status === SubmissionStatus.OK).length;
      const warnCount = subs.filter((s) => s.status === SubmissionStatus.WARNING).length;
      const critCount = subs.filter((s) => s.status === SubmissionStatus.CRITICAL).length;
      const total = subs.length;
      return {
        templateId: template.id,
        templateName: template.name,
        frequency: template.frequency,
        totalSubmissions: total,
        ok: okCount,
        warnings: warnCount,
        critical: critCount,
        compliancePercent: total > 0 ? Math.round((okCount / total) * 100) : null,
      };
    });

    const totalSubmissions = submissions.length;
    const overallCompliance = totalSubmissions > 0
      ? Math.round(
          (submissions.filter((s) => s.status === SubmissionStatus.OK).length / totalSubmissions) * 100,
        )
      : null;

    return {
      organizationId,
      period: { year, month, from: startDate.toISOString(), to: endDate.toISOString() },
      summary: {
        totalSubmissions,
        overallCompliance,
        criticalIssues: submissions.filter((s) => s.status === SubmissionStatus.CRITICAL).length,
        warnings: submissions.filter((s) => s.status === SubmissionStatus.WARNING).length,
      },
      templateStats,
    };
  }

  async complianceSummary(organizationId: string, days: number, requestingUser: User) {
    if (
      requestingUser.role !== Role.SUPER_ADMIN &&
      requestingUser.organizationId !== organizationId
    ) {
      return { error: 'Access denied' };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const submissions = await this.submissionRepo.find({
      where: { organizationId, createdAt: Between(since, new Date()) },
    });

    const total = submissions.length;
    const ok = submissions.filter((s) => s.status === SubmissionStatus.OK).length;
    const warnings = submissions.filter((s) => s.status === SubmissionStatus.WARNING).length;
    const critical = submissions.filter((s) => s.status === SubmissionStatus.CRITICAL).length;

    return {
      organizationId,
      days,
      since: since.toISOString(),
      totalSubmissions: total,
      ok,
      warnings,
      critical,
      compliancePercent: total > 0 ? Math.round((ok / total) * 100) : null,
    };
  }
}
