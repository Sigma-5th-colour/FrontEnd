'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Typography,
  Tooltip,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Empty,
  Pagination,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  CalendarOutlined,
  SearchOutlined,
  ReloadOutlined,
  RollbackOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { AdvancedFilterPanel } from '@/components/filters';
import { useHRLeave, useHRLeaveTypes, useHREmployees } from '@/hooks/api/useHR';
import { useHrActionGates } from '@/hooks/useActionPermissionGates';
import { RequestStatus, type HRRequestPrintDto, type LeaveRequestDto, type CreateLeaveRequestDto } from '@/types/hr.types';
import {
  ApprovalStageTag,
  ApprovalSteps,
  PrintPreview,
  RequestStatusTag,
  canActOnApprovalStage,
} from '@/app/hr/_components/requestWorkflow';
import styles from './Leave.module.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

export default function HRLeavePage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [rejectRecord, setRejectRecord] = useState<LeaveRequestDto | null>(null);
  const [printData, setPrintData] = useState<HRRequestPrintDto | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const hrGates = useHrActionGates();
  const pageSize = 10;

  const {
    leaveRequests,
    isLoading,
    createLeave,
    approveLeave,
    rejectLeave,
    withdrawLeave,
    printLeave,
    refetch,
    isCreating,
    isApproving,
    isRejecting,
    isWithdrawing,
    isPrinting,
  } = useHRLeave();

  const { leaveTypes } = useHRLeaveTypes();
  const { employees, isLoading: isLoadingEmployees } = useHREmployees(
    { pageSize: 200 },
    hrGates.canManage
  );

  const leaveTypeNameById = useMemo(
    () => Object.fromEntries(leaveTypes.map((lt) => [lt.id, lt.name])),
    [leaveTypes]
  );
  const employeeNameById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.nameAr || e.nameEn || e.id])),
    [employees]
  );

  const resolveEmployeeName = (r: LeaveRequestDto) =>
    r.employeeName || (r.employeeId ? employeeNameById[r.employeeId] : undefined) || '—';
  const resolveLeaveTypeName = (r: LeaveRequestDto) =>
    r.leaveTypeName || (r.leaveTypeId ? leaveTypeNameById[r.leaveTypeId] : undefined) || '—';

  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  const pendingCount = leaveRequests.filter((r) => r.status === RequestStatus.Pending).length;
  const approvedCount = leaveRequests.filter((r) => r.status === RequestStatus.Approved).length;
  const rejectedCount = leaveRequests.filter((r) => r.status === RequestStatus.Rejected).length;
  const withdrawnCount = leaveRequests.filter((r) => r.status === RequestStatus.Withdrawn).length;

  const filteredRequests = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return leaveRequests.filter((r) => {
      if (statusFilter != null && r.status !== statusFilter) return false;
      if (q) {
        const haystack =
          `${resolveEmployeeName(r)} ${resolveLeaveTypeName(r)} ${r.reason ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveRequests, statusFilter, searchText, employeeNameById, leaveTypeNameById]);

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

  const handleCreate = async () => {
    if (!hrGates.canSubmitRequest) return;
    try {
      const values = await form.validateFields();
      const dto: CreateLeaveRequestDto = {
        ...(hrGates.canManage && values.employeeId ? { employeeId: values.employeeId } : {}),
        leaveTypeId: values.leaveTypeId,
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        reason: values.reason,
      };
      await createLeave(dto);
      setCreateModalOpen(false);
      form.resetFields();
    } catch {
      // Form validation and API failures are already shown inline or by mutation toasts.
    }
  };

  const runAction = (id: string, fn: () => Promise<unknown>) => {
    setActioningId(id);
    return fn()
      .catch(() => {})
      .finally(() => setActioningId(null));
  };

  const handleReject = async () => {
    if (!rejectRecord) return;
    try {
      const values = await rejectForm.validateFields();
      setActioningId(rejectRecord.id);
      await rejectLeave({ requestId: rejectRecord.id, reason: values.reason });
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
      const data = await printLeave(id);
      setPrintData(data);
    } catch {
      // Hook displays the API error.
    } finally {
      setActioningId(null);
    }
  };

  const renderActions = (record: LeaveRequestDto) => {
    const isPending = record.status === RequestStatus.Pending;
    const canApproveThisStage = canActOnApprovalStage(record, hrGates);
    const canWithdraw = isPending && (hrGates.canSubmitRequest || hrGates.canManage);

    return (
      <Space wrap>
        <Tooltip title="طباعة">
          <Button
            icon={<PrinterOutlined />}
            loading={isPrinting && actioningId === record.id}
            onClick={() => handlePrint(record.id)}
          >
            طباعة
          </Button>
        </Tooltip>
        {canWithdraw && (
          <Popconfirm
            title="تأكيد سحب طلب الإجازة؟"
            onConfirm={() => runAction(record.id, () => withdrawLeave(record.id))}
            okText="سحب"
            cancelText="إلغاء"
          >
            <Button icon={<RollbackOutlined />} loading={isWithdrawing && actioningId === record.id}>
              سحب الطلب
            </Button>
          </Popconfirm>
        )}
        {canApproveThisStage && (
          <>
            <Popconfirm
              title="تأكيد الموافقة على المرحلة الحالية؟"
              onConfirm={() => runAction(record.id, () => approveLeave({ requestId: record.id }))}
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
          <CalendarOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>طلبات الإجازات</Title>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>تحديث</Button>
          {hrGates.canSubmitRequest && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              size="large"
            >
              طلب إجازة جديدة
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="قيد الانتظار" value={pendingCount} styles={{ content: { color: '#faad14' } }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="معتمدة" value={approvedCount} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="مرفوضة" value={rejectedCount} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
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
              placeholder="بحث بالموظف أو النوع أو السبب..."
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
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
                  : 'لا توجد طلبات إجازة'
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
                      <strong>{resolveEmployeeName(record)}</strong>
                    </Space>
                    <span className={styles.requestSubtitle}>{resolveLeaveTypeName(record)}</span>
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
                          <span>من تاريخ</span>
                          <strong>{record.fromDate ? dayjs(record.fromDate).format('YYYY/MM/DD') : '—'}</strong>
                        </div>
                      </Col>
                      <Col xs={12} sm={8}>
                        <div className={styles.detailItem}>
                          <span>إلى تاريخ</span>
                          <strong>{record.toDate ? dayjs(record.toDate).format('YYYY/MM/DD') : '—'}</strong>
                        </div>
                      </Col>
                      <Col xs={12} sm={8}>
                        <div className={styles.detailItem}>
                          <span>عدد الأيام</span>
                          <strong>{record.daysCount != null ? `${record.daysCount} يوم` : '—'}</strong>
                        </div>
                      </Col>
                      <Col xs={24}>
                        <div className={styles.reasonBlock}>
                          <span>السبب</span>
                          <p>{record.reason || '—'}</p>
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
        open={createModalOpen && hrGates.canSubmitRequest}
        title="طلب إجازة جديدة"
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCreate}
        confirmLoading={isCreating}
        okText="تقديم الطلب"
        cancelText="إلغاء"
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {hrGates.canManage && (
            <Form.Item
              name="employeeId"
              label="الموظف"
              rules={[{ required: true, message: 'يرجى اختيار الموظف' }]}
            >
              <Select
                showSearch
                placeholder="اختر الموظف لإنشاء الطلب باسمه"
                loading={isLoadingEmployees}
                optionFilterProp="label"
                options={employees.map((e) => ({
                  value: e.id,
                  label: e.nameAr || e.nameEn || e.id,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item
            name="leaveTypeId"
            label="نوع الإجازة"
            rules={[{ required: true, message: 'يرجى اختيار نوع الإجازة' }]}
          >
            <Select
              placeholder="اختر نوع الإجازة"
              options={leaveTypes.map((lt) => ({
                value: lt.id,
                label: `${lt.name}${lt.isPaid ? ' (مدفوعة)' : ' (غير مدفوعة)'}`,
                disabled: !lt.isActive,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="فترة الإجازة"
            rules={[{ required: true, message: 'يرجى تحديد فترة الإجازة' }]}
          >
            <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="سبب الإجازة"
            rules={[{ required: true, message: 'يرجى كتابة سبب الإجازة' }]}
          >
            <TextArea rows={3} maxLength={500} showCount placeholder="اكتب سبب الإجازة..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!rejectRecord}
        title="رفض طلب الإجازة"
        onCancel={() => {
          setRejectRecord(null);
          rejectForm.resetFields();
        }}
        onOk={handleReject}
        confirmLoading={isRejecting && actioningId === rejectRecord?.id}
        okText="رفض"
        okButtonProps={{ danger: true }}
        cancelText="إلغاء"
        width={480}
        destroyOnHidden
      >
        {rejectRecord && (
          <div style={{ marginBottom: 12, color: '#555' }}>
            <strong>الموظف:</strong> {resolveEmployeeName(rejectRecord)}&nbsp;&nbsp;
            <strong>الفترة:</strong>{' '}
            {rejectRecord.fromDate ? dayjs(rejectRecord.fromDate).format('YYYY/MM/DD') : '—'}
            {' — '}
            {rejectRecord.toDate ? dayjs(rejectRecord.toDate).format('YYYY/MM/DD') : '—'}
          </div>
        )}
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="سبب الرفض"
            rules={[{ required: true, message: 'اكتب سبب الرفض' }]}
          >
            <TextArea rows={3} maxLength={500} showCount placeholder="اكتب سبب الرفض..." />
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
