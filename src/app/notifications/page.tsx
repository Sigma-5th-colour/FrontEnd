'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { AdvancedFilterPanel } from '@/components/filters';
import { useNotificationMutations, useNotifications } from '@/hooks/api/useNotifications';
import { notificationReferenceRoute } from '@/lib/navigation/notificationRoutes';
import type { NotificationDto } from '@/types/notification.types';

const { Title, Text } = Typography;
const PAGE_SIZE = 10;

export default function NotificationsPage() {
  const router = useRouter();
  const [pageNumber, setPageNumber] = useState(1);
  const [isRead, setIsRead] = useState<boolean | undefined>(undefined);
  const [search, setSearch] = useState('');
  const { data, isLoading, isFetching, refetch } = useNotifications({
    pageNumber,
    pageSize: PAGE_SIZE,
    isRead: isRead ?? null,
  });
  const { markRead, markAllRead, deleteNotification, isMarkingAllRead, isDeleting } =
    useNotificationMutations();

  const notifications = useMemo(() => data?.items ?? [], [data?.items]);
  const filteredNotifications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((item) =>
      `${item.title ?? ''} ${item.message ?? ''} ${item.type ?? ''} ${item.referenceType ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [notifications, search]);

  const openNotification = async (item: NotificationDto) => {
    if (!item.isRead) await markRead(item.id).catch(() => {});
    router.push(notificationReferenceRoute(item.referenceType, item.referenceId));
  };

  const columns: ColumnsType<NotificationDto> = [
    {
      title: 'الحالة',
      dataIndex: 'isRead',
      width: 90,
      render: (value: boolean | null | undefined) =>
        value ? <Tag>مقروء</Tag> : <Tag color="blue">جديد</Tag>,
    },
    {
      title: 'العنوان',
      dataIndex: 'title',
      width: 220,
      render: (value, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openNotification(record)}>
          {value || record.type || 'إشعار'}
        </Button>
      ),
    },
    {
      title: 'الرسالة',
      dataIndex: 'message',
      ellipsis: true,
      render: (value) => value || '—',
    },
    {
      title: 'المرجع',
      dataIndex: 'referenceType',
      width: 150,
      render: (value, record) => value || record.referenceId || '—',
    },
    {
      title: 'التاريخ',
      dataIndex: 'createdAt',
      width: 160,
      render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {!record.isRead && (
            <Button
              type="text"
              icon={<CheckOutlined />}
              onClick={() => markRead(record.id).catch(() => {})}
            />
          )}
          <Popconfirm
            title="حذف الإشعار؟"
            okText="حذف"
            cancelText="إلغاء"
            onConfirm={() => deleteNotification(record.id).catch(() => {})}
          >
            <Button type="text" danger icon={<DeleteOutlined />} loading={isDeleting} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <BellOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>الإشعارات</Title>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>
            تحديث
          </Button>
          <Button loading={isMarkingAllRead} onClick={() => markAllRead().catch(() => {})}>
            تعليم الكل كمقروء
          </Button>
        </Space>
      </div>

      <AdvancedFilterPanel
        activeCount={(isRead !== undefined ? 1 : 0) + (search.trim() ? 1 : 0)}
        onClear={() => {
          setIsRead(undefined);
          setSearch('');
          setPageNumber(1);
        }}
        quickFilters={
          <>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="بحث في الإشعارات..."
              style={{ width: 280 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              allowClear
              placeholder="حالة القراءة"
              style={{ width: 170 }}
              value={isRead}
              onChange={(value) => {
                setIsRead(value);
                setPageNumber(1);
              }}
              options={[
                { value: false, label: 'غير مقروء' },
                { value: true, label: 'مقروء' },
              ]}
            />
          </>
        }
      />

      <Card>
        <Table<NotificationDto>
          rowKey="id"
          columns={columns}
          dataSource={filteredNotifications}
          loading={isLoading}
          scroll={{ x: 950 }}
          pagination={{
            current: pageNumber,
            pageSize: PAGE_SIZE,
            total: data?.totalCount ?? 0,
            showSizeChanger: false,
            onChange: setPageNumber,
            showTotal: (total) => `إجمالي: ${total} إشعار`,
          }}
          locale={{ emptyText: <Text type="secondary">لا توجد إشعارات</Text> }}
        />
      </Card>
    </div>
  );
}
