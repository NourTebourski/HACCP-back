import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  async findAll(page = 1, limit = 20) {
    const [data, total] = await this.orgRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async create(dto: CreateOrganizationDto) {
    const existing = await this.orgRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Organization name already exists');
    const org = this.orgRepo.create(dto);
    return this.orgRepo.save(org);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.findOne(id);
    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  async deactivate(id: string) {
    const org = await this.findOne(id);
    org.isActive = false;
    await this.orgRepo.save(org);
    return { message: 'Organization deactivated' };
  }

  async getStats(id: string) {
    await this.findOne(id);
    const userCount = await this.orgRepo
      .createQueryBuilder('org')
      .leftJoin('org.users', 'user')
      .where('org.id = :id', { id })
      .select('COUNT(user.id)', 'userCount')
      .getRawOne<{ userCount: string }>();

    const submissionCount = await this.orgRepo
      .createQueryBuilder('org')
      .leftJoin('org.submissions', 'submission')
      .where('org.id = :id', { id })
      .select('COUNT(submission.id)', 'submissionCount')
      .getRawOne<{ submissionCount: string }>();

    return {
      organizationId: id,
      userCount: parseInt(userCount?.userCount || '0', 10),
      submissionCount: parseInt(submissionCount?.submissionCount || '0', 10),
    };
  }
}
