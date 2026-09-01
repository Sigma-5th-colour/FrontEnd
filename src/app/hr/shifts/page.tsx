'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  ClockCircleOutlined,
  EditOutlined,
  PlusOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import AccessDenied from '@/components/common/AccessDenied';
import { useHREmployees, useHRShifts } from '@/hooks/api/useHR';
import { useHrActionGates } from '@/hooks/useActionPermissionGates';
import type { CreateShiftDto, ShiftDto, UpdateShiftDto } from '@/types/hr.types';

const { Title } = Typography;

export default function HRShiftsPage() {
  const hrGates = useHrActionGates();
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [editing, setEditing] = useState<ShiftDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assigning, setAssigning] = useState<ShiftDto | null>(null);

  const {
    shifts,
    isLoading,
    createShift,
    updateShift,
    setShiftActive,
    assignShift,
    isCreating,
    isUpdating,
    isSettingActive,
    isAssigning,
  } = useHRShifts(false);
  const { employees, isLoading: isLoadingEmployees } = useHREmployees(
    { pageSize: 500 },
    hrGates.canManageShifts
  );

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: `${employee.nameAr || employee.nameEn || employee.id}${employee.employeeNumber ? ` (${employee.employeeNumber})` : ''}`,
  }));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, gracePeriodMinutes: 5 });
    setModalOpen(true);
  };

  const openEdit = (record: ShiftDto) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      startTime: record.startTime ? dayjs(record.startTime, 'HH:mm:ss') : undefined,
      endTime: record.endTime ? dayjs(record.endTime, 'HH:mm:ss') : undefined,
      gracePeriodMinutes: record.gracePeriodMinutes ?? 5,
      isActive: record.isActive ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: CreateShiftDto | UpdateShiftDto = {
        name: values.name,
        startTime: values.startTime.format('HH:mm:ss'),
        endTime: values.endTime.format('HH:mm:ss'),
        gracePeriodMinutes: values.gracePeriodMinutes,
        isActive: values.isActive ?? true,
      };
      if (editing) {
        await updateShift({ id: editing.id, data: payload });
      } else {
        await createShift(payload);
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    } catch {
      // Validation/API errors are shown by antd and mutation hooks.
    }
  };

  const handleAssign = async () => {
    if (!assigning) return;
    try {
      const values = await assignForm.validateFields();
      await assignShift({
        employeeId: values.employeeId,
        shiftId: assigning.id,
        effectiveFrom: values.effectiveFrom ? values.effectiveFrom.toISOString() : null,
      });
      setAssigning(null);
      assignForm.resetFields();
    } catch {
      // Validation/API errors are shown by antd and mutation hooks.
    }
  };

  const columns: ColumnsType<ShiftDto> = [
    {
      title: 'الوردية',
      dataIndex: 'name',
      render: (value) => value || '—',
    },
    {
      title: 'البداية',
      dataIndex: 'startTime',
      width: 120,
      render: (value) => value?.slice(0, 5) || '—',
    },
    {
      title: 'النهاية',
      dataIndex: 'endTime',
      width: 120,
      render: (value) => value?.slice(0, 5) || '—',
    },
    {
      title: 'فترة السماح',
      dataIndex: 'gracePeriodMinutes',
      width: 130,
      render: (value) => `${value ?? 0} دقيقة`,
    },
    {
      title: 'الحالة',
      dataIndex: 'isActive',
      width: 110,
      render: (value) => (value ? <Tag color="success">نشطة</Tag> : <Tag color="default">معطلة</Tag>),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Space>
          <Tooltip title="تعديل">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="تعيين لموظف">
            <Button type="text" icon={<UserSwitchOutlined />} onClick={() => setAssigning(record)} />
          </Tooltip>
          <Popconfirm
            title={record.isActive ? 'تعطيل الوردية؟' : 'تفعيل الوردية؟'}
            onConfirm={() => setShiftActive({ id: record.id, isActive: !record.isActive })}
            okText="نعم"
            cancelText="إلغاء"
          >
            <Switch size="small" checked={!!record.isActive} loading={isSettingActive} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (hrGates.isReady && !hrGates.canManageShifts) return <AccessDenied />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <ClockCircleOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>إدارة الورديات</Title>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="large">
          إضافة وردية
        </Button>
      </div>

      <Card>
        <Table<ShiftDto>
          dataSource={shifts}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'لا توجد ورديات' }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'تعديل الوردية' : 'إضافة وردية'}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={isCreating || isUpdating}
        okText={editing ? 'حفظ' : 'إضافة'}
        cancelText="إلغاء"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="اسم الوردية" rules={[{ required: true, message: 'اسم الوردية مطلوب' }]}>
            <Input placeholder="Shift 1 (09:00-17:00)" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="startTime" label="وقت البداية" rules={[{ required: true, message: 'وقت البداية مطلوب' }]}>
              <TimePicker format="HH:mm" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="endTime" label="وقت النهاية" rules={[{ required: true, message: 'وقت النهاية مطلوب' }]}>
              <TimePicker format="HH:mm" style={{ width: 180 }} />
            </Form.Item>
          </Space>
          <Form.Item name="gracePeriodMinutes" label="فترة السماح بالدقائق" rules={[{ required: true }]}>
            <InputNumber min={0} max={240} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="الحالة" valuePropName="checked">
            <Switch checkedChildren="نشطة" unCheckedChildren="معطلة" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!assigning}
        title="تعيين الوردية لموظف"
        onCancel={() => {
          setAssigning(null);
          assignForm.resetFields();
        }}
        onOk={handleAssign}
        confirmLoading={isAssigning}
        okText="تعيين"
        cancelText="إلغاء"
        destroyOnHidden
      >
        <Form form={assignForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="employeeId" label="الموظف" rules={[{ required: true, message: 'اختر الموظف' }]}>
            <Select
              showSearch
              placeholder="اختر الموظف"
              loading={isLoadingEmployees}
              options={employeeOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="effectiveFrom" label="تاريخ البداية">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
