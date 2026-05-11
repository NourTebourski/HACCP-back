import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { NotificationsGateway } from './notifications.gateway';

export interface CreateNotificationData {
  userId: string;
  organizationId?: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private gateway: NotificationsGateway,
  ) {}

  async create(data: CreateNotificationData) {
    const notif = this.notifRepo.create(data);
    const saved = await this.notifRepo.save(notif);

    // Emit in real-time
    this.gateway.emitToUser(data.userId, 'notification:new', saved);

    if (data.organizationId) {
      this.gateway.emitToOrg(data.organizationId, 'notification:org', saved);
    }

    return saved;
  }

  async findAllForUser(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const unreadCount = await this.notifRepo.count({ where: { userId, isRead: false } });
    return { data, total, unreadCount, page, limit };
  }

  async markAsRead(id: string, userId: string) {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    return this.notifRepo.save(notif);
  }

  async markAllAsRead(userId: string) {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
    return { message: 'All notifications marked as read' };
  }

  async emitToOrg(organizationId: string, event: string, data: unknown) {
    this.gateway.emitToOrg(organizationId, event, data);
  }

  async emitToUser(userId: string, event: string, data: unknown) {
    this.gateway.emitToUser(userId, event, data);
  }
}
