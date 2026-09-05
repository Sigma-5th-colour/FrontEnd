export interface NotificationDto {
  id: string;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  isRead?: boolean | null;
  createdAt?: string | null;
  readAt?: string | null;
}

export interface NotificationListQuery {
  pageNumber?: number;
  pageSize?: number;
  isRead?: boolean | null;
}

export interface UnreadNotificationCountDto {
  count: number;
}
