import { useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message, notification } from 'antd';
import { API_CONFIG } from '@/config/api.config';
import { NotificationService } from '@/services/notification.service';
import { extractApiError } from '@/lib/api/unwrap';
import { useAuthStore } from '@/store/authStore';
import type { NotificationDto, NotificationListQuery } from '@/types/notification.types';

const QK = {
  list: (query?: NotificationListQuery) => ['notifications', query] as const,
  unread: (take?: number) => ['notifications-unread', take] as const,
  unreadCount: ['notifications-unread-count'] as const,
};

function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  queryClient.invalidateQueries({ queryKey: QK.unreadCount });
}

export function useNotificationRealtime() {
  const queryClient = useQueryClient();
  const branchId = useAuthStore((state) => state.branchId);

  useEffect(() => {
    if (!branchId || typeof window === 'undefined') return;

    const hubBaseUrl = API_CONFIG.BASE_URL.replace(/\/$/, '');
    const connection = new HubConnectionBuilder()
      .withUrl(`${hubBaseUrl}/hubs/notifications`, {
        accessTokenFactory: () =>
          localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '',
        headers: { 'X-Branch-Id': branchId },
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(
        process.env.NEXT_PUBLIC_ENV === 'development' ? LogLevel.Warning : LogLevel.None
      )
      .build();

    let disposed = false;
    const refresh = () => invalidateNotificationQueries(queryClient);

    connection.on('ReceiveNotification', (incoming: NotificationDto) => {
      if (disposed) return;
      refresh();
      notification.info({
        message: incoming.title || incoming.type || 'إشعار جديد',
        description: incoming.message || undefined,
        placement: 'topLeft',
      });
    });
    connection.onreconnected(refresh);

    void connection.start().catch((error) => {
      // REST polling remains active when the hub is temporarily unavailable.
      if (process.env.NEXT_PUBLIC_ENV === 'development') {
        console.warn('Notification realtime connection failed:', error);
      }
    });

    return () => {
      disposed = true;
      connection.off('ReceiveNotification');
      void connection.stop();
    };
  }, [branchId, queryClient]);
}

export function useNotifications(query?: NotificationListQuery, enabled = true) {
  return useQuery({
    queryKey: QK.list(query),
    queryFn: () => NotificationService.getAll(query),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useUnreadNotifications(take = 10, enabled = true) {
  return useQuery({
    queryKey: QK.unread(take),
    queryFn: () => NotificationService.getUnread(take),
    refetchInterval: 60000,
    enabled,
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: QK.unreadCount,
    queryFn: () => NotificationService.getUnreadCount(),
    refetchInterval: 60000,
    enabled,
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateNotificationQueries(queryClient);

  const markRead = useMutation({
    mutationFn: (id: string) => NotificationService.markRead(id),
    onSuccess: invalidate,
    onError: (err) => message.error(extractApiError(err, 'فشل تحديث الإشعار')),
  });

  const markAllRead = useMutation({
    mutationFn: () => NotificationService.markAllRead(),
    onSuccess: () => {
      invalidate();
      message.success('تم تعليم كل الإشعارات كمقروءة');
    },
    onError: (err) => message.error(extractApiError(err, 'فشل تعليم الإشعارات كمقروءة')),
  });

  const deleteNotification = useMutation({
    mutationFn: (id: string) => NotificationService.delete(id),
    onSuccess: () => {
      invalidate();
      message.success('تم حذف الإشعار');
    },
    onError: (err) => message.error(extractApiError(err, 'فشل حذف الإشعار')),
  });

  return {
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    deleteNotification: deleteNotification.mutateAsync,
    isMarkingRead: markRead.isPending,
    isMarkingAllRead: markAllRead.isPending,
    isDeleting: deleteNotification.isPending,
  };
}
