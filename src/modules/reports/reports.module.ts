import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../submissions/submission.entity';
import { Template } from '../templates/template.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Template])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
