'use client';

import { Badge, Button, Empty, List, Popover, Space, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import {
  useNotificationMutations,
  useNotificationRealtime,
  useUnreadNotificationCount,
  useUnreadNotifications,
} from '@/hooks/api/useNotifications';
import { notificationReferenceRoute } from '@/lib/navigation/notificationRoutes';
import type { NotificationDto } from '@/types/notification.types';
import styles from '@/components/layout/Header.module.css';

const { Text } = Typography;

export default function NotificationBell() {
  const router = useRouter();
  useNotificationRealtime();
  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useUnreadNotifications(5);
  const { markRead, markAllRead, isMarkingAllRead } = useNotificationMutations();

  const openNotification = async (notification: NotificationDto) => {
    if (!notification.isRead) {
      await markRead(notification.id).catch(() => {});
    }
    router.push(notificationReferenceRoute(notification.referenceType, notification.referenceId));
  };

  const content = (
    <div style={{ width: 360, maxWidth: '85vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong>الإشعارات</Text>
        <Button
          type="link"
          size="small"
          loading={isMarkingAllRead}
          disabled={count === 0}
          onClick={() => markAllRead().catch(() => {})}
        >
          تعليم الكل كمقروء
        </Button>
      </div>
      <List
        loading={isLoading}
        dataSource={notifications}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد إشعارات غير مقروءة" /> }}
        renderItem={(item) => (
          <List.Item
            style={{ cursor: 'pointer', paddingInline: 0 }}
            onClick={() => openNotification(item)}
          >
            <List.Item.Meta
              title={<Text strong={!item.isRead}>{item.title || item.type || 'إشعار'}</Text>}
              description={
                <Space direction="vertical" size={2}>
                  <Text type="secondary">{item.message || '—'}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
      <Button type="link" block onClick={() => router.push('/notifications')}>
        عرض كل الإشعارات
      </Button>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomLeft">
      <Badge count={count} size="small" className={styles.notificationBadge}>
        <Button type="text" icon={<BellOutlined />} className={styles.iconBtn} />
      </Badge>
    </Popover>
  );
}
