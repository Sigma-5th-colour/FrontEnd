'use client';

import { Button, Card, DatePicker, Form, Select, Space, Typography } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AccessDenied from '@/components/common/AccessDenied';
import { useHREmployees, useHRReportExport } from '@/hooks/api/useHR';
import { useHrActionGates } from '@/hooks/useActionPermissionGates';
import type { HRReportType } from '@/types/hr.types';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const REPORT_OPTIONS: Array<{ value: HRReportType; label: string }> = [
  { value: 'attendance', label: 'الحضور والانصراف' },
  { value: 'permission', label: 'طلبات الاستئذان' },
  { value: 'vacation', label: 'طلبات الإجازات السنوية' },
  { value: 'leave', label: 'الإجازات' },
];

export default function HRReportsPage() {
  const [form] = Form.useForm();
  const hrGates = useHrActionGates();
  const exportReport = useHRReportExport();
  const { employees, isLoading: isLoadingEmployees } = useHREmployees(
    { pageSize: 500 },
    hrGates.canExportReports
  );

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: `${employee.nameAr || employee.nameEn || employee.id}${employee.employeeNumber ? ` (${employee.employeeNumber})` : ''}`,
  }));

  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      const range: [dayjs.Dayjs, dayjs.Dayjs] | undefined = values.range;
      const monthYear: dayjs.Dayjs | undefined = values.monthYear;
      exportReport.mutate({
        reportType: values.reportType,
        employeeId: values.employeeId || null,
        fromDate: range?.[0] ? range[0].startOf('day').toISOString() : null,
        toDate: range?.[1] ? range[1].endOf('day').toISOString() : null,
        month: monthYear ? monthYear.month() + 1 : null,
        year: monthYear ? monthYear.year() : null,
      });
    } catch {
      // Form validation errors are shown inline.
    }
  };

  if (hrGates.isReady && !hrGates.canExportReports) return <AccessDenied />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <Space>
          <FileExcelOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>تقارير الموارد البشرية</Title>
        </Space>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ reportType: 'attendance' }}
          style={{ maxWidth: 720 }}
        >
          <Form.Item name="reportType" label="نوع التقرير" rules={[{ required: true, message: 'نوع التقرير مطلوب' }]}>
            <Select options={REPORT_OPTIONS} />
          </Form.Item>
          <Form.Item name="employeeId" label="الموظف">
            <Select
              allowClear
              showSearch
              placeholder="كل الموظفين"
              loading={isLoadingEmployees}
              options={employeeOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item name="range" label="الفترة">
              <RangePicker style={{ width: 320 }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="monthYear" label="الشهر والسنة">
              <DatePicker picker="month" style={{ width: 180 }} format="YYYY-MM" />
            </Form.Item>
          </Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exportReport.isPending}
            onClick={handleExport}
          >
            تصدير Excel
          </Button>
        </Form>
      </Card>
    </div>
  );
}
