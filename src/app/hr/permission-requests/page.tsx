'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Tooltip,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  Modal,
  Form,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AdvancedFilterPanel } from '@/components/filters';
import { useHRPermissionRequests } from '@/hooks/api/useHR';
import { useHrActionGates } from '@/hooks/useActionPermissionGates';
import { RequestStatus, type HRRequestPrintDto, type PermissionRequestDto } from '@/types/hr.types';
import {
  ApprovalStageTag,
  ApprovalSteps,
  PrintPreview,
  RequestStatusTag,
  canActOnApprovalStage,
} from '../_components/requestWorkflow';
import styles from './PermissionRequests.module.css';

const { Title } = Typography;

const TYPE_LABEL: Record<number, string> = {
  1: 'تأخير صباحي',
  2: 'خروج وعودة',
  3: 'خروج مبكر',
};

const NATURE_LABEL: Record<number, string> = {
  1: 'رسمي',
  2: 'شخصي',
};

export default function PermissionRequestsPage() {
  const hrGates = useHrActionGates();
  const [rejectForm] = Form.useForm();
  const {
    permissionRequests,
    isLoading,
    refetch,
    approvePermissionRequest,
    rejectPermissionRequest,
    withdrawPermissionRequest,
    printPermissionRequest,
    isApproving,
    isRejecting,
    isWithdrawing,
    isPrinting,
  } = useHRPermissionRequests();

  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectRecord, setRejectRecord] = useState<PermissionRequestDto | null>(null);
  const [printData, setPrintData] = useState<HRRequestPrintDto | null>(null);

  const runAction = (id: string, fn: (id: string) => Promise<unknown>) => {
    setActioningId(id);
    return fn(id)
      .catch(() => {})
      .finally(() => setActioningId(null));
  };

  const handleReject = async () => {
    if (!rejectRecord) return;
    try {
      const values = await rejectForm.validateFields();
      setActioningId(rejectRecord.id);
      await rejectPermissionRequest({ id: rejectRecord.id, reason: values.reason });
      setRejectRecord(null);
      rejectForm.resetFields();
    } catch {
      // Validation and mutation errors are displayed by antd / hooks.
    } finally {
      setActioningId(null);
    }
  };

  const handlePrint = async (id: string) => {
    setActioningId(id);
    try {
      const data = await printPermissionRequest(id);
      setPrintData(data);
    } catch {
      // Hook displays the API error.
    } finally {
      setActioningId(null);
    }
  };

  const pendingCount  = permissionRequests.filter((r) => r.status === RequestStatus.Pending).length;
  const approvedCount = permissionRequests.filter((r) => r.status === RequestStatus.Approved).length;
  const rejectedCount = permissionRequests.filter((r) => r.status === RequestStatus.Rejected).length;
  const withdrawnCount = permissionRequests.filter((r) => r.status === RequestStatus.Withdrawn).length;

  const filteredRequests = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return permissionRequests.filter((r) => {
      if (statusFilter != null && r.status !== statusFilter) return false;
      if (q) {
        const haystack = `${r.employeeName ?? ''} ${r.reasons ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [permissionRequests, statusFilter, searchText]);

  const columns: ColumnsType<PermissionRequestDto> = [
    {
      title: 'الموظف',
      dataIndex: 'employeeName',
      render: (v) => v || '—',
    },
    {
      title: 'تاريخ الاستئذان',
      dataIndex: 'permissionDate',
      width: 140,
      render: (v) => (v ? dayjs(v).format('YYYY/MM/DD') : '—'),
    },
    {
      title: 'نوع الاستئذان',
      dataIndex: 'permissionType',
      width: 130,
      render: (v: number) => (
        <Tag color="blue">{TYPE_LABEL[v] ?? `نوع ${v}`}</Tag>
      ),
    },
    {
      title: 'الطبيعة',
      dataIndex: 'permissionNature',
      width: 90,
      render: (v: number) => NATURE_LABEL[v] ?? '—',
    },
    {
      title: 'الوقت',
      key: 'time',
      width: 110,
      render: (_, r) => {
        if (r.permissionType === 1) return r.comeLateTime || '—';
        if (r.permissionType === 2) return `${r.partTimeStart || '—'} — ${r.partTimeFinish || '—'}`;
        if (r.permissionType === 3) return r.outEarlyTime || '—';
        return '—';
      },
    },
    {
      title: 'الأسباب',
      dataIndex: 'reasons',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      width: 130,
      render: (v: number) => <RequestStatusTag status={v} />,
    },
    {
      title: 'مرحلة الاعتماد',
      dataIndex: 'approval',
      width: 170,
      render: (_, record) => <ApprovalStageTag approval={record.approval} />,
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 170,
      render: (_, record) => {
        const canApprove = canActOnApprovalStage(record, hrGates);
        const isPending = record.status === RequestStatus.Pending;
        return (
          <Space>
            <Tooltip title="طباعة">
              <Button
                type="text"
                icon={<PrinterOutlined />}
                loading={isPrinting && actioningId === record.id}
                onClick={() => handlePrint(record.id)}
              />
            </Tooltip>
            {isPending && (
              <Tooltip title="سحب الطلب">
                <Popconfirm
                  title="سحب طلب الاستئذان؟"
                  onConfirm={() => runAction(record.id, withdrawPermissionRequest)}
                  okText="سحب"
                  cancelText="إلغاء"
                >
                  <Button
                    type="text"
                    icon={<RollbackOutlined />}
                    loading={isWithdrawing && actioningId === record.id}
                  />
                </Popconfirm>
              </Tooltip>
            )}
            {canApprove && (
              <>
            <Tooltip title="موافقة">
              <Popconfirm
                title="تأكيد الموافقة على طلب الاستئذان؟"
                onConfirm={() => runAction(record.id, approvePermissionRequest)}
                okText="موافقة"
                cancelText="إلغاء"
              >
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  style={{ color: '#52c41a' }}
                  loading={isApproving && actioningId === record.id}
                />
              </Popconfirm>
            </Tooltip>
            <Tooltip title="رفض">
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejectRecord(record)}
                  loading={isRejecting && actioningId === record.id}
                />
            </Tooltip>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <ClockCircleOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>سجل طلبات الاستئذان</Title>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>تحديث</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="قيد الانتظار" value={pendingCount} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="موافق عليها" value={approvedCount} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="مرفوضة" value={rejectedCount} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="مسحوبة" value={withdrawnCount} styles={{ content: { color: '#8c8c8c' } }} />
          </Card>
        </Col>
      </Row>

      <AdvancedFilterPanel
        activeCount={(statusFilter != null ? 1 : 0) + (searchText.trim() ? 1 : 0)}
        onClear={() => {
          setStatusFilter(undefined);
          setSearchText('');
        }}
        quickFilters={
          <>
            <Input
              placeholder="بحث بالاسم أو السبب..."
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div>
              <label className={styles.filterLabel}>تصفية بالحالة</label>
              <Select
                placeholder="تصفية بالحالة"
                allowClear
                style={{ width: 180 }}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: RequestStatus.Pending, label: 'قيد الانتظار' },
                  { value: RequestStatus.Approved, label: 'موافق عليه' },
                  { value: RequestStatus.Rejected, label: 'مرفوض' },
                  { value: RequestStatus.Withdrawn, label: 'مسحوب' },
                ]}
              />
            </div>
          </>
        }
      />

      <Card>
        <Table<PermissionRequestDto>
          dataSource={filteredRequests}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 15,
            showSizeChanger: false,
            showTotal: (total) => `إجمالي: ${total} طلب`,
          }}
          locale={{
            emptyText:
              statusFilter != null || searchText
                ? 'لا توجد نتائج مطابقة'
                : 'لا توجد طلبات استئذان',
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        open={!!rejectRecord}
        title="رفض طلب الاستئذان"
        onCancel={() => {
          setRejectRecord(null);
          rejectForm.resetFields();
        }}
        onOk={handleReject}
        confirmLoading={isRejecting && actioningId === rejectRecord?.id}
        okText="رفض"
        cancelText="إلغاء"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        {rejectRecord && <ApprovalSteps approval={rejectRecord.approval} />}
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="reason" label="سبب الرفض" rules={[{ required: true, message: 'سبب الرفض مطلوب' }]}>
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!printData}
        title="معاينة الطباعة"
        onCancel={() => setPrintData(null)}
        footer={<Button onClick={() => window.print()} icon={<PrinterOutlined />}>طباعة</Button>}
        width={760}
        destroyOnHidden
      >
        {printData && <PrintPreview data={printData} />}
      </Modal>
    </div>
  );
}
