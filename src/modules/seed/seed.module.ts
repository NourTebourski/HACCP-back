import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from '../templates/template.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Template, Organization, User])],
  providers: [SeedService],
})
export class SeedModule {}
