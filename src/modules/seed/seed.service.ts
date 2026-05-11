import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Template } from '../templates/template.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Role } from '../../common/enums/role.enum';
import { HACCP_TEMPLATES } from '../templates/templates.seed';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Template) private templateRepo: Repository<Template>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedTemplates();
    await this.seedSuperAdmin();
    await this.seedDemoData();
  }

  private async seedTemplates() {
    for (const templateData of HACCP_TEMPLATES) {
      const existing = await this.templateRepo.findOne({ where: { name: templateData.name } });
      if (!existing) {
        await this.templateRepo.save(this.templateRepo.create(templateData));
        this.logger.log(`Seeded template: ${templateData.name}`);
      }
    }
  }

  private async seedSuperAdmin() {
    const email = 'admin@haccp.com';
    const existing = await this.userRepo.findOne({ where: { email } });
    if (!existing) {
      const hashed = await bcrypt.hash('Admin@123456', 10);
      await this.userRepo.save(
        this.userRepo.create({
          email,
          password: hashed,
          firstName: 'Super',
          lastName: 'Admin',
          role: Role.SUPER_ADMIN,
        }),
      );
      this.logger.log(`Seeded super admin: ${email}`);
    }
  }

  private async seedDemoData() {
    // Create demo org
    let demoOrg = await this.orgRepo.findOne({ where: { name: 'Demo Restaurant GmbH' } });
    if (!demoOrg) {
      demoOrg = await this.orgRepo.save(
        this.orgRepo.create({
          name: 'Demo Restaurant GmbH',
          address: 'Musterstraße 1, 10115 Berlin',
          phone: '+49 30 123456',
          email: 'info@demo-restaurant.de',
        }),
      );
      this.logger.log(`Seeded demo org: ${demoOrg.name}`);
    }

    // Create demo owner
    const ownerEmail = 'owner@demo.com';
    if (!(await this.userRepo.findOne({ where: { email: ownerEmail } }))) {
      await this.userRepo.save(
        this.userRepo.create({
          email: ownerEmail,
          password: await bcrypt.hash('Owner@123456', 10),
          firstName: 'Demo',
          lastName: 'Owner',
          role: Role.OWNER,
          organizationId: demoOrg.id,
        }),
      );
      this.logger.log(`Seeded demo owner: ${ownerEmail}`);
    }

    // Create demo workers
    const workers = [
      { email: 'worker1@demo.com', firstName: 'Anna', lastName: 'Schmidt' },
      { email: 'worker2@demo.com', firstName: 'Max', lastName: 'Müller' },
    ];

    for (const w of workers) {
      if (!(await this.userRepo.findOne({ where: { email: w.email } }))) {
        await this.userRepo.save(
          this.userRepo.create({
            email: w.email,
            password: await bcrypt.hash('Worker@123456', 10),
            firstName: w.firstName,
            lastName: w.lastName,
            role: Role.WORKER,
            organizationId: demoOrg.id,
          }),
        );
        this.logger.log(`Seeded demo worker: ${w.email}`);
      }
    }
  }
}
