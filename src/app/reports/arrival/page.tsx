'use client';

import { useState } from 'react';
import { Button, Card, Col, DatePicker, Input, InputNumber, Row, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClearOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/authStore';
import { useAgents } from '@/hooks/api/useAgents';
import { useJobs } from '@/hooks/api/useJobs';
import { useNationalities } from '@/hooks/api/useNationalities';
import { useArrivalReport } from '@/hooks/api/useArrivalReport';
import { MEDIATION_CONTRACT_STATUS, getEnumLabel } from '@/constants/enums';
import type { ArrivalReportItem, ArrivalReportQuery } from '@/types/api.types';

const { RangePicker } = DatePicker;

const RELIGIONS = [
  { value: 1, ar: 'مسلم', en: 'Muslim' },
  { value: 2, ar: 'مسيحي', en: 'Christian' },
  { value: 3, ar: 'أخرى', en: 'Other' },
] as const;

const INITIAL_FILTERS: ArrivalReportQuery = { pageNumber: 1, pageSize: 10, includeSubBranches: true };

export default function ArrivalReportPage() {
  const router = useRouter();
  const language = useAuthStore((state) => state.language);
  const isAr = language === 'ar';
  const [filters, setFilters] = useState<ArrivalReportQuery>(INITIAL_FILTERS);
  const { data: report, isLoading, isFetching, refetch } = useArrivalReport(filters);
  const { data: nationalities = [] } = useNationalities({ type: 2, isActiveOnly: true });
  const { data: agents = [] } = useAgents();
  const { data: jobs = [] } = useJobs();

  const t = (ar: string, en: string) => (isAr ? ar : en);
  const update = <K extends keyof ArrivalReportQuery>(key: K, value: ArrivalReportQuery[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value, pageNumber: 1 }));
  };
  const toDate = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD') : '—');
  const dateRange = (from: keyof ArrivalReportQuery, to: keyof ArrivalReportQuery) =>
    [filters[from] ? dayjs(filters[from] as string) : null, filters[to] ? dayjs(filters[to] as string) : null] as any;
  const setRange = (from: keyof ArrivalReportQuery, to: keyof ArrivalReportQuery, values: string[]) => {
    setFilters((previous) => ({
      ...previous,
      [from]: values?.[0] || undefined,
      [to]: values?.[1] || undefined,
      pageNumber: 1,
    }));
  };

  const columns: ColumnsType<ArrivalReportItem> = [
      {
        title: t('العقد', 'Contract'),
        key: 'contract',
        width: 135,
        fixed: 'left',
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/contracts/mediationcontract/${row.contractId}`)}
            >
              #{row.contractNumber ?? '—'}
            </Button>
            <Tag color={row.hasArrived ? 'green' : 'default'}>
              {isAr ? row.arrivalStatusAr || 'غير واصل' : row.arrivalStatusEn || 'Not arrived'}
            </Tag>
          </Space>
        ),
      },
      {
        title: t('العميل', 'Customer'),
        key: 'customer',
        width: 220,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <strong>{row.customerName || '—'}</strong>
            <span>{row.customerMobile || row.customerEmail || '—'}</span>
            {row.customerNationalId && <small>{row.customerNationalId}</small>}
          </Space>
        ),
      },
      {
        title: t('العاملة', 'Worker'),
        key: 'worker',
        width: 220,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <strong>{row.workerName || '—'}</strong>
            <span>{(isAr ? row.nationalityAr : row.nationalityEn) || row.nationalityAr || '—'}</span>
            <small>{row.passportNumber || row.idNumber || '—'}</small>
          </Space>
        ),
      },
      {
        title: t('التأشيرة والوصول', 'Visa & Arrival'),
        key: 'arrival',
        width: 200,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>{t('التأشيرة: ', 'Visa: ')}{row.visaNumber || '—'}</span>
            <span>{t('الوصول: ', 'Arrival: ')}{toDate(row.arrivalDate)} {row.arrivalTime || ''}</span>
            <small>{row.arrivalDestination || '—'}</small>
          </Space>
        ),
      },
      {
        title: t('الوكيل', 'Agent'),
        dataIndex: 'agentName',
        width: 160,
        render: (value) => value || '—',
      },
      {
        title: t('الحالة', 'Status'),
        key: 'status',
        width: 180,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Tag color={row.contractStatusId === 17 ? 'red' : 'blue'}>
              {(isAr ? row.contractStatusNameAr : row.contractStatusNameEn) || '—'}
            </Tag>
            <span>{(isAr ? row.contractReplacementStatusAr : row.contractReplacementStatusEn) || '—'}</span>
          </Space>
        ),
      },
      {
        title: t('الضمان', 'Warranty'),
        key: 'warranty',
        width: 180,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>{(isAr ? row.guaranteeStatusAr : row.guaranteeStatusEn) || '—'}</span>
            {row.hasWarrantyReturn && <Tag color="orange">{t('يوجد إرجاع', 'Returned')}</Tag>}
          </Space>
        ),
      },
      {
        title: t('تاريخ الإنشاء', 'Created'),
        dataIndex: 'createdAt',
        width: 120,
        render: toDate,
      },
  ];

  const reset = () => setFilters(INITIAL_FILTERS);

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={4} style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{t('تقرير متابعة الوصول', 'Arrival Tracking Report')}</h1>
        <span style={{ color: '#666' }}>
          {t('متابعة وصول العاملات لعقود الاستقدام', 'Track worker arrivals for mediation contracts')}
        </span>
      </Space>

      <Card title={t('الفلاتر', 'Filters')} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12} lg={8}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('بحث: عقد، مساند، تأشيرة، عميل أو عاملة', 'Search contract, Musaned, visa, customer or worker')}
              value={filters.search}
              onChange={(event) => update('search', event.target.value || undefined)}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder={t('رقم العقد', 'Contract #')}
              value={filters.contractNumber}
              onChange={(value) => update('contractNumber', value ?? undefined)}
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Input
              allowClear
              placeholder={t('اسم العميل', 'Customer name')}
              value={filters.customerName}
              onChange={(event) => update('customerName', event.target.value || undefined)}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Input
              allowClear
              placeholder={t('رقم الجوال', 'Mobile number')}
              value={filters.mobileNumber}
              onChange={(event) => update('mobileNumber', event.target.value || undefined)}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Input
              allowClear
              placeholder={t('البريد الإلكتروني', 'Email')}
              value={filters.email}
              onChange={(event) => update('email', event.target.value || undefined)}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Input
              allowClear
              placeholder={t('رقم الهوية', 'ID number')}
              value={filters.idNumber}
              onChange={(event) => update('idNumber', event.target.value || undefined)}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Input
              allowClear
              placeholder={t('رقم التأشيرة', 'Visa number')}
              value={filters.visaNumber}
              onChange={(event) => update('visaNumber', event.target.value || undefined)}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder={t('الجنسية', 'Nationality')}
              value={filters.nationalityId}
              onChange={(value) => update('nationalityId', value)}
              options={nationalities.map((item) => ({
                value: String(item.id),
                label: (isAr ? item.nationalityNameAr : item.nationalityNameEn) || item.nationalityNameAr || item.nationalityNameEn,
              }))}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder={t('الوكيل', 'Agent')}
              value={filters.agentId}
              onChange={(value) => update('agentId', value)}
              options={agents.map((item) => ({
                value: String(item.id),
                label: (isAr ? item.agentNameAr : item.agentNameEn) || item.agentNameAr || item.agentNameEn,
              }))}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder={t('حالة العقد', 'Contract status')}
              value={filters.manualContractStatus}
              onChange={(value) => update('manualContractStatus', value)}
              options={MEDIATION_CONTRACT_STATUS.map((status) => ({
                value: status.value,
                label: getEnumLabel([...MEDIATION_CONTRACT_STATUS], status.value, language),
              }))}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder={t('الديانة', 'Religion')}
              value={filters.religion}
              onChange={(value) => update('religion', value)}
              options={RELIGIONS.map((item) => ({ value: item.value, label: isAr ? item.ar : item.en }))}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              placeholder={t('المهنة', 'Occupation')}
              value={filters.jobId}
              onChange={(value) => update('jobId', value)}
              options={jobs.map((item) => ({
                value: String(item.id),
                label: (isAr ? item.jobNameAr : item.jobNameEn) || item.jobNameAr || item.jobNameEn,
              }))}
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange('visaDateFrom', 'visaDateTo')}
              onChange={(_, values) => setRange('visaDateFrom', 'visaDateTo', values)}
              placeholder={[t('التأشيرة من', 'Visa from'), t('التأشيرة إلى', 'Visa to')]}
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange('createdDateFrom', 'createdDateTo')}
              onChange={(_, values) => setRange('createdDateFrom', 'createdDateTo', values)}
              placeholder={[t('الإنشاء من', 'Created from'), t('الإنشاء إلى', 'Created to')]}
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange('arrivalDateFrom', 'arrivalDateTo')}
              onChange={(_, values) => setRange('arrivalDateFrom', 'arrivalDateTo', values)}
              placeholder={[t('الوصول من', 'Arrival from'), t('الوصول إلى', 'Arrival to')]}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder={t('نوع العقد', 'Contract type')}
              value={filters.contractReplacementStatus}
              onChange={(value) => update('contractReplacementStatus', value)}
              options={[
                { value: false, label: t('عادي', 'Normal') },
                { value: true, label: t('بدل / نقل', 'Replacement / Transfer') },
              ]}
            />
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder={t('الضمان', 'Warranty')}
              value={filters.guaranteeStatus}
              onChange={(value) => update('guaranteeStatus', value)}
              options={MEDIATION_CONTRACT_STATUS.map((status) => ({
                value: status.value,
                label: getEnumLabel([...MEDIATION_CONTRACT_STATUS], status.value, language),
              }))}
            />
          </Col>
          <Col xs={24}>
            <Space wrap>
              <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
                {t('تحديث', 'Refresh')}
              </Button>
              <Button icon={<ClearOutlined />} onClick={reset}>{t('مسح الفلاتر', 'Clear filters')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title={`${t('النتائج', 'Results')} (${report?.totalCount ?? 0})`} bodyStyle={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            rowKey="contractId"
            loading={isLoading}
            columns={columns}
            dataSource={report?.items ?? []}
            scroll={{ x: 1295 }}
            pagination={{
              current: filters.pageNumber,
              pageSize: filters.pageSize,
              total: report?.totalCount ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${t('الإجمالي', 'Total')}: ${total}`,
              onChange: (pageNumber, pageSize) =>
                setFilters((previous) => ({ ...previous, pageNumber, pageSize })),
            }}
          />
        </div>
      </Card>
    </div>
  );
}
