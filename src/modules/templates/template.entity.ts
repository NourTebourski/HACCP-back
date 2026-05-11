import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Frequency } from '../../common/enums/frequency.enum';

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  required: boolean;
  unit?: string;
  min?: number;
  max?: number;
  criticalMin?: number;
  criticalMax?: number;
  options?: string[];
  hint?: string;
}

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: Frequency })
  frequency: Frequency;

  @Column({ type: 'json' })
  fields: FieldDefinition[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Submission', 'template')
  submissions: unknown[];
}
