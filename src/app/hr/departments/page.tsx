'use client';

import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Typography,
  Tag,
  Select,
  Tooltip,
} from 'antd';
import { PlusOutlined, ApartmentOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDepartments } from '@/hooks/api/useAdmin';
import { useHREmployees } from '@/hooks/api/useHR';
import { useHrActionGates } from '@/hooks/useActionPermissionGates';
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from '@/types/hr.types';

const { Title } = Typography;

export default function HRDepartmentsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form] = Form.useForm();
  const hrGates = useHrActionGates();

  const {
    departments,
    isLoading,
    createDepartment,
    updateDepartment,
    isCreating,
    isUpdating,
  } = useDepartments();
  const { employees, isLoading: isLoadingEmployees } = useHREmployees({ pageSize: 500 }, hrGates.canManage);

  const openCreate = () => {
    if (!hrGates.canCreate) return;
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Department) => {
    if (!hrGates.canUpdate) return;
    setEditing(record);
    form.setFieldsValue({
      nameAr: record.nameAr,
      nameEn: record.nameEn,
      managerEmployeeId: record.managerEmployeeId || undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (editing ? !hrGates.canUpdate : !hrGates.canCreate) return;
    try {
      const values = await form.validateFields();
      const payload: CreateDepartmentDto | UpdateDepartmentDto = {
        nameAr: values.nameAr,
        nameEn: values.nameEn || null,
        managerEmployeeId: values.managerEmployeeId || null,
      };
      if (editing) {
        await updateDepartment({ id: editing.id, data: payload });
      } else {
        await createDepartment(payload);
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
    } catch {
      // Form validation or API errors are surfaced by antd / the mutation toast.
    }
  };

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: `${employee.nameAr || employee.nameEn || employee.id}${employee.employeeNumber ? ` (${employee.employeeNumber})` : ''}`,
  }));

  const columns: ColumnsType<Department> = [
    {
      title: '#',
      key: 'index',
      width: 60,
      render: (_, __, idx) => (
        <Tag color="blue" style={{ minWidth: 32, textAlign: 'center' }}>
          {idx + 1}
        </Tag>
      ),
    },
    {
      title: 'اسم القسم بالعربية',
      dataIndex: 'nameAr',
      render: (v) => <strong>{v || '—'}</strong>,
    },
    {
      title: 'اسم القسم بالإنجليزية',
      dataIndex: 'nameEn',
      render: (v) => v || '—',
    },
    {
      title: 'مدير الوحدة',
      key: 'manager',
      render: (_, record) =>
        record.managerEmployeeNameAr || record.managerEmployeeNameEn || record.managerEmployeeId || '—',
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 80,
      render: (_, record) =>
        hrGates.canUpdate ? (
          <Tooltip title="تعديل">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <ApartmentOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>
            الأقسام
          </Title>
        </Space>
        {hrGates.canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="large">
            إضافة قسم
          </Button>
        )}
      </div>

      <Card>
        <Table<Department>
          dataSource={departments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'لا توجد أقسام — أضف قسماً جديداً' }}
        />
      </Card>

      <Modal
        open={modalOpen && (editing ? hrGates.canUpdate : hrGates.canCreate)}
        title={editing ? 'تعديل القسم' : 'إضافة قسم جديد'}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={isCreating || isUpdating}
        okText={editing ? 'حفظ' : 'إضافة'}
        cancelText="إلغاء"
        width={460}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="nameAr"
            label="اسم القسم بالعربية"
            rules={[{ required: true, message: 'اسم القسم بالعربية مطلوب' }]}
          >
            <Input placeholder="مثال: الموارد البشرية" />
          </Form.Item>
          <Form.Item name="nameEn" label="اسم القسم بالإنجليزية">
            <Input placeholder="e.g. Human Resources" />
          </Form.Item>
          <Form.Item name="managerEmployeeId" label="مدير الوحدة">
            <Select
              allowClear
              showSearch
              placeholder="اختر مدير الوحدة"
              loading={isLoadingEmployees}
              options={employeeOptions}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
