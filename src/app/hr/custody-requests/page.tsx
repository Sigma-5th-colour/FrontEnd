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
  Modal,
  Form,
  Descriptions,
  Row,
  Col,
  Statistic,
  Input,
  Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  InboxOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AdvancedFilterPanel } from '@/components/filters';
import { useHRCustodyRequests, useHREmployees } from '@/hooks/api/useHR';
import { useHrActionGates } from '@/hooks/useActionPermissionGates';
import {
  RequestStatus,
  type CustodyRequestDto,
  type CustodyRequestItemDto,
  type HRRequestPrintDto,
} from '@/types/hr.types';
import {
  ApprovalStageTag,
  ApprovalSteps,
  PrintPreview,
  RequestStatusTag,
  canActOnApprovalStage,
} from '../_components/requestWorkflow';
import styles from './CustodyRequests.module.css';

const { Title } = Typography;

// Status enum is 1=Approved, 2=Rejected, 3=Pending (verified live) — see RequestStatus.
const STATUS_COLOR: Record<number, string> = {
  [RequestStatus.Pending]: 'warning',
  [RequestStatus.Approved]: 'success',
  [RequestStatus.Rejected]: 'error',
  [RequestStatus.Withdrawn]: 'default',
};
const STATUS_LABEL: Record<number, string> = {
  [RequestStatus.Pending]: 'قيد الانتظار',
  [RequestStatus.Approved]: 'موافق عليه',
  [RequestStatus.Rejected]: 'مرفوض',
  [RequestStatus.Withdrawn]: 'مسحوب',
};

const itemColumns: ColumnsType<CustodyRequestItemDto> = [
  {
    title: '#',
    key: 'idx',
    width: 40,
    render: (_: any, __: any, i: number) => i + 1,
  },
  {
    title: 'نوع العهدة',
    dataIndex: 'custodyTypeName',
    render: (v) => v || '—',
  },
  {
    title: 'الكمية',
    dataIndex: 'quantity',
    width: 80,
    render: (v) => v ?? '—',
  },
  {
    title: 'تاريخ التسليم',
    dataIndex: 'deliveryDate',
    render: (v) => (v ? dayjs(v).format('YYYY/MM/DD') : '—'),
  },
  {
    title: 'النوع',
    dataIndex: 'temporal',
    width: 90,
    render: (v) =>
      v == null ? '—' : <Tag color={v ? 'orange' : 'blue'}>{v ? 'مؤقتة' : 'دائمة'}</Tag>,
  },
];

export default function CustodyRequestsPage() {
  const [detailRecord, setDetailRecord] = useState<CustodyRequestDto | null>(null);
  const [rejectRecord, setRejectRecord] = useState<CustodyRequestDto | null>(null);
  const [printData, setPrintData] = useState<HRRequestPrintDto | null>(null);
  const [rejectForm] = Form.useForm();
  const hrGates = useHrActionGates();

  const {
    custodyRequests,
    isLoading,
    refetch,
    approveCustodyRequest,
    rejectCustodyRequest,
    withdrawCustodyRequest,
    printCustodyRequest,
    isApproving,
    isRejecting,
    isWithdrawing,
    isPrinting,
  } = useHRCustodyRequests();

  const { employees } = useHREmployees({ pageSize: 500 });
  const employeeMap = Object.fromEntries(
    employees.map((e) => [e.id, e.nameAr || e.nameEn || e.id])
  );

  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const runAction = (id: string, fn: (id: string) => Promise<unknown>) => {
    setActioningId(id);
    // onError toast already shown by the mutation; catch here so a rejection
    // doesn't bubble as unhandled — Popconfirm's onConfirm doesn't await this.
    return fn(id).catch(() => {}).finally(() => setActioningId(null));
  };

  const handleReject = async () => {
    if (!rejectRecord) return;
    try {
      const values = await rejectForm.validateFields();
      setActioningId(rejectRecord.id);
      await rejectCustodyRequest({ id: rejectRecord.id, reason: values.reason });
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
      const data = await printCustodyRequest(id);
      setPrintData(data);
    } catch {
      // Hook displays the API error.
    } finally {
      setActioningId(null);
    }
  };

  const pendingCount  = custodyRequests.filter((r) => r.status === RequestStatus.Pending).length;
  const approvedCount = custodyRequests.filter((r) => r.status === RequestStatus.Approved).length;
  const rejectedCount = custodyRequests.filter((r) => r.status === RequestStatus.Rejected).length;
  const withdrawnCount = custodyRequests.filter((r) => r.status === RequestStatus.Withdrawn).length;

  const filteredRequests = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return custodyRequests.filter((r) => {
      if (statusFilter != null && r.status !== statusFilter) return false;
      if (q) {
        const employeeName = r.employeeId ? (employeeMap[r.employeeId] ?? '') : '';
        const haystack = `${employeeName} ${r.details ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [custodyRequests, statusFilter, searchText, employeeMap]);

  const columns: ColumnsType<CustodyRequestDto> = [
    {
      title: 'الموظف',
      dataIndex: 'employeeId',
      render: (v) => employeeMap[v] ?? v ?? '—',
    },
    {
      title: 'التفاصيل',
      dataIndex: 'details',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'عدد الأصناف',
      key: 'itemsCount',
      width: 110,
      render: (_, record) => record.items?.length ?? 0,
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
      width: 190,
      render: (_, record) => {
        const isPending = record.status === RequestStatus.Pending;
        const canApprove = canActOnApprovalStage(record, hrGates);
        return (
          <Space>
            <Tooltip title="عرض التفاصيل">
              <Button type="text" icon={<EyeOutlined />} onClick={() => setDetailRecord(record)} />
            </Tooltip>
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
                  title="سحب طلب العهدة؟"
                  onConfirm={() => runAction(record.id, withdrawCustodyRequest)}
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
                    title="تأكيد الموافقة على طلب العهدة؟"
                    onConfirm={() => runAction(record.id, approveCustodyRequest)}
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
          <InboxOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>سجل طلبات العهد</Title>
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
        activeCount={statusFilter != null ? 1 : 0}
        onClear={() => setStatusFilter(undefined)}
        quickFilters={
          <>
            <Input
              placeholder="بحث بالموظف أو التفاصيل..."
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
        <Table<CustodyRequestDto>
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
                : 'لا توجد طلبات عهد',
          }}
          scroll={{ x: 700 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!detailRecord}
        title={<Space><InboxOutlined />تفاصيل طلب العهدة</Space>}
        onCancel={() => setDetailRecord(null)}
        footer={<Button onClick={() => setDetailRecord(null)}>إغلاق</Button>}
        width={680}
        destroyOnHidden
      >
        {detailRecord && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="الموظف" span={2}>
                {detailRecord.employeeId ? (employeeMap[detailRecord.employeeId] ?? detailRecord.employeeId) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="الحالة">
                <Tag color={STATUS_COLOR[detailRecord.status ?? 0] ?? 'default'}>
                  {STATUS_LABEL[detailRecord.status ?? 0] ?? `حالة ${detailRecord.status}`}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="مرحلة الاعتماد">
                <ApprovalStageTag approval={detailRecord.approval} />
              </Descriptions.Item>
              <Descriptions.Item label="عدد الأصناف">
                {detailRecord.items?.length ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="التفاصيل" span={2}>
                {detailRecord.details || '—'}
              </Descriptions.Item>
            </Descriptions>

            {detailRecord.items && detailRecord.items.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 8 }}>أصناف العهد</Title>
                <Table
                  dataSource={detailRecord.items}
                  columns={itemColumns}
                  rowKey={(r, i) => r.id ?? String(i)}
                  pagination={false}
                  size="small"
                  bordered
                />
              </>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={!!rejectRecord}
        title="رفض طلب العهدة"
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
