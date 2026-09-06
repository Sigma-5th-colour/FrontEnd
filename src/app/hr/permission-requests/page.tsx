'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Tag,
  Space,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  Modal,
  Form,
  Empty,
  Pagination,
  Spin,
} from 'antd';
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
  printHrRequestPreview,
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  const paginatedRequests = useMemo(
    () => filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRequests, currentPage, pageSize]
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, filteredRequests.length, pageSize]);

  const resolvePermissionTime = (record: PermissionRequestDto) => {
    if (record.permissionType === 1) return record.comeLateTime || '—';
    if (record.permissionType === 2) return `${record.partTimeStart || '—'} — ${record.partTimeFinish || '—'}`;
    if (record.permissionType === 3) return record.outEarlyTime || '—';
    return '—';
  };

  const resolvePermissionTypeLabel = (value?: number | null) =>
    value == null ? '—' : TYPE_LABEL[value] ?? `نوع ${value}`;

  const resolvePermissionNatureLabel = (value?: number | null) =>
    value == null ? '—' : NATURE_LABEL[value] ?? '—';

  const renderActions = (record: PermissionRequestDto) => {
    const canApprove = canActOnApprovalStage(record, hrGates);
    const isPending = record.status === RequestStatus.Pending;

    return (
      <Space wrap>
        <Button
          icon={<PrinterOutlined />}
          loading={isPrinting && actioningId === record.id}
          onClick={() => handlePrint(record.id)}
        >
          طباعة
        </Button>
        {isPending && (
          <Popconfirm
            title="سحب طلب الاستئذان؟"
            onConfirm={() => runAction(record.id, withdrawPermissionRequest)}
            okText="سحب"
            cancelText="إلغاء"
          >
            <Button icon={<RollbackOutlined />} loading={isWithdrawing && actioningId === record.id}>
              سحب الطلب
            </Button>
          </Popconfirm>
        )}
        {canApprove && (
          <>
            <Popconfirm
              title="تأكيد الموافقة على طلب الاستئذان؟"
              onConfirm={() => runAction(record.id, approvePermissionRequest)}
              okText="موافقة"
              cancelText="إلغاء"
            >
              <Button
                icon={<CheckOutlined />}
                style={{ color: '#52c41a' }}
                loading={isApproving && actioningId === record.id}
              >
                موافقة
              </Button>
            </Popconfirm>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => setRejectRecord(record)}
              loading={isRejecting && actioningId === record.id}
            >
              رفض
            </Button>
          </>
        )}
      </Space>
    );
  };

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
          setCurrentPage(1);
        }}
        quickFilters={
          <>
            <Input
              placeholder="بحث بالاسم أو السبب..."
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
            />
            <div>
              <label className={styles.filterLabel}>تصفية بالحالة</label>
              <Select
                placeholder="تصفية بالحالة"
                allowClear
                style={{ width: 180 }}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setCurrentPage(1);
                }}
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

      <Spin spinning={isLoading}>
        {filteredRequests.length === 0 ? (
          <Card>
            <Empty
              description={
                statusFilter != null || searchText
                  ? 'لا توجد نتائج مطابقة'
                  : 'لا توجد طلبات استئذان'
              }
            />
          </Card>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {paginatedRequests.map((record, index) => (
              <Card
                key={record.id}
                className={styles.requestCard}
                title={
                  <Space direction="vertical" size={4}>
                    <Space wrap>
                      <span className={styles.requestNumber}>
                        #{(currentPage - 1) * pageSize + index + 1}
                      </span>
                      <strong>{record.employeeName || '—'}</strong>
                    </Space>
                    <Space wrap>
                      <Tag color="blue">{resolvePermissionTypeLabel(record.permissionType)}</Tag>
                      <span className={styles.requestSubtitle}>
                        {resolvePermissionNatureLabel(record.permissionNature)}
                      </span>
                    </Space>
                  </Space>
                }
                extra={
                  <Space wrap>
                    <RequestStatusTag status={record.status} />
                    <ApprovalStageTag approval={record.approval} />
                  </Space>
                }
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={16}>
                    <Row gutter={[12, 12]}>
                      <Col xs={12} sm={8}>
                        <div className={styles.detailItem}>
                          <span>تاريخ الاستئذان</span>
                          <strong>
                            {record.permissionDate ? dayjs(record.permissionDate).format('YYYY/MM/DD') : '—'}
                          </strong>
                        </div>
                      </Col>
                      <Col xs={12} sm={8}>
                        <div className={styles.detailItem}>
                          <span>الوقت</span>
                          <strong>{resolvePermissionTime(record)}</strong>
                        </div>
                      </Col>
                      <Col xs={12} sm={8}>
                        <div className={styles.detailItem}>
                          <span>الطبيعة</span>
                          <strong>{resolvePermissionNatureLabel(record.permissionNature)}</strong>
                        </div>
                      </Col>
                      <Col xs={24}>
                        <div className={styles.reasonBlock}>
                          <span>الأسباب</span>
                          <p>{record.reasons || '—'}</p>
                        </div>
                      </Col>
                    </Row>
                  </Col>

                  <Col xs={24} lg={8}>
                    <div className={styles.approvalPanel}>
                      <div className={styles.approvalTitle}>مسار الاعتماد</div>
                      <ApprovalSteps
                        approval={record.approval}
                        direction="vertical"
                        className={styles.approvalSteps}
                      />
                    </div>
                  </Col>
                </Row>

                <div className={styles.cardActions}>{renderActions(record)}</div>
              </Card>
            ))}

            <div className={styles.paginationBar}>
              <span>إجمالي: {filteredRequests.length} طلب</span>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredRequests.length}
                showSizeChanger={false}
                onChange={setCurrentPage}
              />
            </div>
          </Space>
        )}
      </Spin>

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
        footer={<Button onClick={printHrRequestPreview} icon={<PrinterOutlined />}>طباعة</Button>}
        width={760}
        destroyOnHidden
      >
        {printData && <PrintPreview data={printData} />}
      </Modal>
    </div>
  );
}
