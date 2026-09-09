'use client';

/**
 * Agent Jobs section — CRUD for per-agent, per-job cost/commission agreements
 * (AgentJob, d-8-9.md). Appended below AgentDetailView's Descriptions block;
 * this is the first sub-table on the agent detail page, so there's no
 * existing tabs/section precedent to mirror on this screen — it follows the
 * Table + Modal + Form idiom used by the mediation offers page instead.
 */
import React, { useMemo, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  Popconfirm,
  Space,
  Divider,
  Empty,
  Tag,
  Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  useAgentJobsByAgent,
  useCreateAgentJob,
  useUpdateAgentJob,
  useDeleteAgentJob,
} from '@/hooks/api/useAgentJobs';
import { useJobs } from '@/hooks/api/useJobs';
import { useHasPermission } from '@/hooks/api/usePagePermissions';
import { APP_PERMISSIONS } from '@/config/appPermissions';
import { WORKER_TYPE, PREVIOUS_EXPERIENCE, getEnumLabel, toSelectOptions } from '@/constants/enums';
import type { AgentJob, CreateAgentJobDto, UpdateAgentJobDto } from '@/types/api.types';

export interface AgentJobsSectionProps {
  agentId: string;
  language: 'ar' | 'en';
}

interface AgentJobFormValues {
  jobId: string;
  workerType?: number | null;
  previousExperience?: number | null;
  cost: number;
  alternativeCost?: number;
  percentAfterSelection: number;
  percentAfterVisa: number;
  percentAfterArrival: number;
  notes?: string | null;
  isActive: boolean;
}

export default function AgentJobsSection({ agentId, language }: AgentJobsSectionProps) {
  const isAr = language === 'ar';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const { has } = useHasPermission();
  const canManage = has(APP_PERMISSIONS.AGENTS_UPDATE);

  const { data: agentJobs = [], isLoading } = useAgentJobsByAgent(agentId);
  const { data: jobs = [] } = useJobs();
  const createMutation = useCreateAgentJob();
  const updateMutation = useUpdateAgentJob();
  const deleteMutation = useDeleteAgentJob();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<AgentJob | null>(null);
  const [form] = Form.useForm<AgentJobFormValues>();

  const jobOptions = useMemo(
    () =>
      (jobs as any[]).map((j) => ({
        value: String(j.id),
        label: (isAr ? j.jobNameAr : j.jobNameEn) || j.jobNameAr || j.jobNameEn || `#${j.id}`,
      })),
    [jobs, isAr]
  );

  const jobLabel = (job: AgentJob) =>
    (isAr ? job.jobNameAr : job.jobNameEn) ||
    job.jobNameAr ||
    job.jobNameEn ||
    jobOptions.find((o) => o.value === String(job.jobId))?.label ||
    `#${job.jobId}`;

  const openCreate = () => {
    setEditingJob(null);
    form.resetFields();
    form.setFieldsValue({
      percentAfterSelection: 0,
      percentAfterVisa: 0,
      percentAfterArrival: 0,
      alternativeCost: 0,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (job: AgentJob) => {
    setEditingJob(job);
    form.setFieldsValue({
      jobId: String(job.jobId),
      workerType: job.workerType ?? undefined,
      previousExperience: job.previousExperience ?? undefined,
      cost: job.cost,
      alternativeCost: job.alternativeCost ?? 0,
      percentAfterSelection: job.percentAfterSelection ?? 0,
      percentAfterVisa: job.percentAfterVisa ?? 0,
      percentAfterArrival: job.percentAfterArrival ?? 0,
      notes: job.notes ?? undefined,
      isActive: job.isActive,
    });
    setModalOpen(true);
  };

  // Client-side guard on the backend rule: the three stage percents must sum
  // to at most 100. Attached to all three fields so editing any one re-checks
  // the total immediately.
  const validatePercentSum = () => {
    const values = form.getFieldsValue();
    const sum =
      (Number(values.percentAfterSelection) || 0) +
      (Number(values.percentAfterVisa) || 0) +
      (Number(values.percentAfterArrival) || 0);
    if (sum > 100) {
      return Promise.reject(
        new Error(t('مجموع النسب يجب ألا يتجاوز 100%', 'Percent total must not exceed 100%'))
      );
    }
    return Promise.resolve();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: CreateAgentJobDto = {
      agentId,
      jobId: values.jobId,
      workerType: values.workerType ?? null,
      previousExperience: values.previousExperience ?? null,
      cost: Number(values.cost) || 0,
      alternativeCost: Number(values.alternativeCost) || 0,
      percentAfterSelection: Number(values.percentAfterSelection) || 0,
      percentAfterVisa: Number(values.percentAfterVisa) || 0,
      percentAfterArrival: Number(values.percentAfterArrival) || 0,
      notes: values.notes || null,
      isActive: values.isActive ?? true,
    };

    if (editingJob) {
      await updateMutation.mutateAsync({ ...payload, id: editingJob.id } as UpdateAgentJobDto);
    } else {
      await createMutation.mutateAsync(payload);
    }
    setModalOpen(false);
  };

  const columns: ColumnsType<AgentJob> = [
    { title: t('الوظيفة', 'Job'), key: 'job', render: (_, row) => jobLabel(row) },
    {
      title: t('نوع العامل', 'Worker Type'),
      dataIndex: 'workerType',
      render: (v: number | null) => getEnumLabel([...WORKER_TYPE], v, language),
    },
    {
      title: t('سبق له العمل', 'Previous Experience'),
      dataIndex: 'previousExperience',
      render: (v: number | null) => getEnumLabel([...PREVIOUS_EXPERIENCE], v, language),
    },
    {
      title: t('التكلفة', 'Cost'),
      dataIndex: 'cost',
      render: (v: number) => v?.toLocaleString() ?? '-',
    },
    {
      title: t('التكلفة البديلة', 'Alternative Cost'),
      dataIndex: 'alternativeCost',
      render: (v: number) => v?.toLocaleString() ?? '-',
    },
    {
      title: t('% بعد اختيار العامل', '% After Selection'),
      dataIndex: 'percentAfterSelection',
      render: (v: number) => `${v ?? 0}%`,
    },
    {
      title: t('% بعد التأشيرة', '% After Visa'),
      dataIndex: 'percentAfterVisa',
      render: (v: number) => `${v ?? 0}%`,
    },
    {
      title: t('% بعد الوصول', '% After Arrival'),
      dataIndex: 'percentAfterArrival',
      render: (v: number) => `${v ?? 0}%`,
    },
    {
      title: t('الحالة', 'Status'),
      dataIndex: 'isActive',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? t('نشط', 'Active') : t('غير نشط', 'Inactive')}</Tag>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      title: t('إجراءات', 'Actions'),
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm
            title={t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete this?')}
            onConfirm={() => deleteMutation.mutate(row.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });
  }

  return (
    <div>
      <Divider titlePlacement="left" style={{ fontSize: 13, color: '#8c8c8c', marginBlockStart: 24 }}>
        {t('وظائف الوكيل', 'Agent Jobs')}
      </Divider>
      {canManage && (
        <div style={{ marginBlockEnd: 12, textAlign: isAr ? 'left' : 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('إضافة وظيفة', 'Add Job')}
          </Button>
        </div>
      )}
      {agentJobs.length > 0 ? (
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={agentJobs}
          columns={columns}
          pagination={false}
        />
      ) : (
        <Empty description={t('لا توجد وظائف مضافة لهذا الوكيل', 'No jobs added for this agent')} />
      )}

      <Modal
        open={modalOpen}
        title={editingJob ? t('تعديل وظيفة الوكيل', 'Edit Agent Job') : t('إضافة وظيفة وكيل', 'Add Agent Job')}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="jobId"
            label={t('الوظيفة', 'Job')}
            rules={[{ required: true, message: t('مطلوب', 'Required') }]}
          >
            <Select
              showSearch
              placeholder={t('اختر الوظيفة', 'Select job')}
              options={jobOptions}
              filterOption={(input, option) =>
                ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="workerType" label={t('نوع العامل', 'Worker Type')}>
            <Select
              allowClear
              placeholder={t('نوع العامل', 'Worker type')}
              options={toSelectOptions([...WORKER_TYPE], language)}
            />
          </Form.Item>
          <Form.Item name="previousExperience" label={t('سبق له العمل', 'Previous Experience')}>
            <Select
              allowClear
              placeholder={t('سبق له العمل', 'Previous experience')}
              options={toSelectOptions([...PREVIOUS_EXPERIENCE], language)}
            />
          </Form.Item>
          <Form.Item
            name="cost"
            label={t('التكلفة', 'Cost')}
            rules={[{ required: true, message: t('مطلوب', 'Required') }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="alternativeCost" label={t('التكلفة البديلة', 'Alternative Cost')}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="percentAfterSelection"
            label={t('% بعد اختيار العامل', '% After Selection')}
            rules={[
              { required: true, message: t('مطلوب', 'Required') },
              { validator: validatePercentSum },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item
            name="percentAfterVisa"
            label={t('% بعد التأشيرة', '% After Visa')}
            rules={[
              { required: true, message: t('مطلوب', 'Required') },
              { validator: validatePercentSum },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item
            name="percentAfterArrival"
            label={t('% بعد الوصول', '% After Arrival')}
            rules={[
              { required: true, message: t('مطلوب', 'Required') },
              { validator: validatePercentSum },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="notes" label={t('ملاحظات', 'Notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="isActive" label={t('نشط', 'Active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
