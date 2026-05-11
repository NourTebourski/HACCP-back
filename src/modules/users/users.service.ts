import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from './user.entity';
import { Role } from '../../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async findAll(requestingUser: User, page = 1, limit = 20) {
    const qb = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'org')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (requestingUser.role === Role.OWNER) {
      qb.where('user.organizationId = :orgId', { orgId: requestingUser.organizationId });
    }

    const [data, total] = await qb.getManyAndCount();
    const safeData = data.map((u) => this.omitPassword(u));
    return { data: safeData, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, requestingUser: User) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (
      requestingUser.role === Role.OWNER &&
      user.organizationId !== requestingUser.organizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.omitPassword(user);
  }

  async create(dto: CreateUserDto, requestingUser: User) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    if (requestingUser.role === Role.OWNER) {
      dto.organizationId = requestingUser.organizationId;
      if (dto.role && dto.role !== Role.WORKER) {
        throw new ForbiddenException('Owners can only create worker accounts');
      }
      dto.role = Role.WORKER;
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({ ...dto, password: hashed });
    const saved = await this.userRepo.save(user);
    return this.omitPassword(saved);
  }

  async update(id: string, dto: UpdateUserDto, requestingUser: User) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (
      requestingUser.role === Role.OWNER &&
      user.organizationId !== requestingUser.organizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    return this.omitPassword(saved);
  }

  async deactivate(id: string, requestingUser: User) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (
      requestingUser.role === Role.OWNER &&
      user.organizationId !== requestingUser.organizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    user.isActive = false;
    await this.userRepo.save(user);
    return { message: 'User deactivated' };
  }

  async reactivate(id: string, requestingUser: User) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (
      requestingUser.role === Role.OWNER &&
      user.organizationId !== requestingUser.organizationId
    ) {
      throw new ForbiddenException('Access denied');
    }

    user.isActive = true;
    await this.userRepo.save(user);
    return { message: 'User reactivated' };
  }

  async updatePassword(id: string, newPassword: string) {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(id, { password: hashed });
    return { message: 'Password updated' };
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  private omitPassword(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...rest } = user;
    return rest;
  }
}
