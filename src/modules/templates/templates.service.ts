import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './template.entity';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template) private templateRepo: Repository<Template>,
  ) {}

  async findAll() {
    return this.templateRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const template = await this.templateRepo.findOne({ where: { id, isActive: true } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async findByName(name: string) {
    return this.templateRepo.findOne({ where: { name } });
  }
}
