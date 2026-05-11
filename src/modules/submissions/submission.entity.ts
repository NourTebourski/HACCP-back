import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Template } from '../templates/template.entity';

export enum SubmissionStatus {
  OK = 'ok',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface SubmissionValue {
  key: string;
  value: string | number | boolean;
}

export interface Violation {
  key: string;
  label: string;
  value: string | number | boolean;
  type: 'critical' | 'warning' | 'missing';
  message: string;
}

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization, (org) => org.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  templateId: string;

  @ManyToOne(() => Template, (t) => t.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: Template;

  @Column()
  submittedById: string;

  @ManyToOne(() => User, (u) => u.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submittedById' })
  submittedBy: User;

  @Column({ type: 'json' })
  values: SubmissionValue[];

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.OK })
  status: SubmissionStatus;

  @Column({ type: 'json', nullable: true })
  violations: Violation[];

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
