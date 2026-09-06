'use client';

import { Descriptions, Space, Steps, Tag } from 'antd';
import type { StepsProps } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  PrinterOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { HRApprovalDto, HRRequestPrintDto } from '@/types/hr.types';
import { HRApprovalStage, RequestStatus } from '@/types/hr.types';

export const REQUEST_STATUS_COLOR: Record<number, string> = {
  [RequestStatus.Approved]: 'success',
  [RequestStatus.Rejected]: 'error',
  [RequestStatus.Pending]: 'warning',
  [RequestStatus.Withdrawn]: 'default',
};

export const REQUEST_STATUS_LABEL: Record<number, string> = {
  [RequestStatus.Approved]: 'موافق عليه',
  [RequestStatus.Rejected]: 'مرفوض',
  [RequestStatus.Pending]: 'قيد الانتظار',
  [RequestStatus.Withdrawn]: 'مسحوب',
};

export const APPROVAL_STAGE_LABEL: Record<number, string> = {
  [HRApprovalStage.PendingUnitManager]: 'مدير الوحدة',
  [HRApprovalStage.PendingHRManager]: 'مدير الموارد البشرية',
  [HRApprovalStage.PendingExecutiveManager]: 'المدير التنفيذي',
  [HRApprovalStage.Approved]: 'مكتمل',
  [HRApprovalStage.Rejected]: 'مرفوض',
  [HRApprovalStage.Withdrawn]: 'مسحوب',
};

export interface HrApprovalGates {
  canApproveUnitManager?: boolean;
  canApproveHrManager?: boolean;
  canApproveExecutiveManager?: boolean;
  canManage?: boolean;
}

export interface WorkflowRecord {
  status?: number | null;
  approval?: HRApprovalDto | null;
}

export function canActOnApprovalStage(record: WorkflowRecord, gates: HrApprovalGates): boolean {
  if (record.status !== RequestStatus.Pending) return false;
  if (gates.canManage) return true;

  switch (record.approval?.approvalStage) {
    case HRApprovalStage.PendingUnitManager:
      return !!gates.canApproveUnitManager;
    case HRApprovalStage.PendingHRManager:
      return !!gates.canApproveHrManager;
    case HRApprovalStage.PendingExecutiveManager:
      return !!gates.canApproveExecutiveManager;
    default:
      return false;
  }
}

export function RequestStatusTag({ status }: { status?: number | null }) {
  if (status == null) return <Tag color="default">—</Tag>;
  return (
    <Tag color={REQUEST_STATUS_COLOR[status] ?? 'default'}>
      {REQUEST_STATUS_LABEL[status] ?? `حالة ${status}`}
    </Tag>
  );
}

export function ApprovalStageTag({ approval }: { approval?: HRApprovalDto | null }) {
  const stage = approval?.approvalStage;
  if (stage == null) return <Tag color="default">—</Tag>;
  return <Tag color="geekblue">{APPROVAL_STAGE_LABEL[stage] ?? `مرحلة ${stage}`}</Tag>;
}

export function ApprovalSteps({
  approval,
  className,
  direction,
}: {
  approval?: HRApprovalDto | null;
  className?: string;
  direction?: StepsProps['direction'];
}) {
  const stage = approval?.approvalStage;
  const rejected = stage === HRApprovalStage.Rejected;
  const withdrawn = stage === HRApprovalStage.Withdrawn;
  const approved = stage === HRApprovalStage.Approved;
  const current = approved || rejected || withdrawn ? 3 : Math.max(0, (stage ?? 1) - 1);

  return (
    <Steps
      size="small"
      className={className}
      direction={direction}
      current={current}
      status={rejected ? 'error' : withdrawn ? 'wait' : approved ? 'finish' : 'process'}
      items={[
        { title: 'مدير الوحدة', icon: approval?.unitManagerStatus === 1 ? <CheckCircleOutlined /> : undefined },
        { title: 'الموارد البشرية', icon: approval?.hrManagerStatus === 1 ? <CheckCircleOutlined /> : undefined },
        { title: 'المدير التنفيذي', icon: approval?.executiveManagerStatus === 1 ? <CheckCircleOutlined /> : undefined },
        {
          title: withdrawn ? 'مسحوب' : rejected ? 'مرفوض' : 'مكتمل',
          icon: withdrawn ? <RollbackOutlined /> : rejected ? <CloseCircleOutlined /> : <ClockCircleOutlined />,
        },
      ]}
    />
  );
}

export function PrintPreview({ data }: { data: HRRequestPrintDto }) {
  const detailEntries = Object.entries(data.details ?? {});

  return (
    <div className="hr-request-print-area">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions title={<Space><PrinterOutlined />بيانات الطباعة</Space>} bordered column={2} size="small">
          <Descriptions.Item label="نوع الطلب">{data.requestType || '—'}</Descriptions.Item>
          <Descriptions.Item label="الحالة"><RequestStatusTag status={data.status} /></Descriptions.Item>
          <Descriptions.Item label="الموظف">{data.employeeName || '—'}</Descriptions.Item>
          <Descriptions.Item label="رقم الموظف">{data.employeeNumber || '—'}</Descriptions.Item>
          <Descriptions.Item label="القسم">{data.departmentName || '—'}</Descriptions.Item>
          <Descriptions.Item label="تاريخ الإنشاء">{data.createdAt || '—'}</Descriptions.Item>
        </Descriptions>
        <ApprovalSteps approval={data.approval} />
        {detailEntries.length > 0 && (
          <Descriptions title="تفاصيل الطلب" bordered column={1} size="small">
            {detailEntries.map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {value == null || value === '' ? '—' : String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Space>
    </div>
  );
}

export function printHrRequestPreview() {
  const printArea = document.querySelector('.hr-request-print-area');
  if (!printArea) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    window.print();
    return;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>طباعة الطلب</title>
    ${styles}
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      html, body { background: #fff !important; direction: rtl; }
      body { margin: 0; padding: 0; color: #000; }
      .print-shell { width: 100%; max-width: 190mm; margin: 0 auto; }
      .hr-request-print-area { position: static !important; inset: auto !important; width: 100% !important; min-height: auto !important; overflow: visible !important; }
      .ant-modal, .ant-modal-root, .ant-modal-wrap, .ant-modal-content, .ant-modal-body { position: static !important; transform: none !important; box-shadow: none !important; padding: 0 !important; }
      .ant-descriptions, .ant-steps { break-inside: avoid; page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <div class="print-shell">${printArea.outerHTML}</div>
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}
