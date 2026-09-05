import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/config/api.config';
import { unwrap, unwrapList } from '@/lib/api/unwrap';
import type { PagedResponse } from '@/types/filters.types';
import type {
  NotificationDto,
  NotificationListQuery,
  UnreadNotificationCountDto,
} from '@/types/notification.types';

function unwrapPagedNotifications(
  payload: any,
  query?: NotificationListQuery
): PagedResponse<NotificationDto> {
  const page = unwrap<any>(payload);
  const items = unwrapList<NotificationDto>(payload);
  return {
    items,
    totalCount: page?.totalCount ?? items.length,
    pageNumber: page?.pageNumber ?? query?.pageNumber ?? 1,
    pageSize: page?.pageSize ?? query?.pageSize ?? items.length,
  };
}

export class NotificationService {
  static async getAll(query?: NotificationListQuery): Promise<PagedResponse<NotificationDto>> {
    const response = await api.get<any>(API_ENDPOINTS.NOTIFICATIONS.GET_ALL, { params: query });
    return unwrapPagedNotifications(response.data, query);
  }

  static async getUnread(take = 50): Promise<NotificationDto[]> {
    const response = await api.get<any>(API_ENDPOINTS.NOTIFICATIONS.UNREAD, { params: { take } });
    return unwrapList<NotificationDto>(response.data);
  }

  static async getUnreadCount(): Promise<number> {
    const response = await api.get<any>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
    const data = unwrap<UnreadNotificationCountDto>(response.data);
    return data?.count ?? 0;
  }

  static async markRead(id: string): Promise<void> {
    await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id), {});
  }

  static async markAllRead(): Promise<void> {
    await api.put(API_ENDPOINTS.NOTIFICATIONS.READ_ALL, {});
  }

  static async delete(id: string): Promise<void> {
    await api.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE(id));
  }
}
