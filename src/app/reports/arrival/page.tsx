'use client';

import { useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Pagination,
  Row,
  Select,
  Spin,
  Tag,
} from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  IdcardOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import { useAuthStore } from '@/store/authStore';
import { useAgents } from '@/hooks/api/useAgents';
import { useJobs } from '@/hooks/api/useJobs';
import { useNationalities } from '@/hooks/api/useNationalities';
import { useArrivalReport } from '@/hooks/api/useArrivalReport';
import { MEDIATION_CONTRACT_STATUS, getEnumLabel } from '@/constants/enums';
import type { ArrivalReportItem, ArrivalReportQuery } from '@/types/api.types';
import contractStyles from '@/app/contracts/mediationcontract/MediationContracts.module.css';
import styles from './ArrivalReport.module.css';

const { RangePicker } = DatePicker;

const RELIGIONS = [
  { value: 1, ar: 'مسلم', en: 'Muslim' },
  { value: 2, ar: 'مسيحي', en: 'Christian' },
  { value: 3, ar: 'أخرى', en: 'Other' },
] as const;

const INITIAL_FILTERS: ArrivalReportQuery = { pageNumber: 1, pageSize: 12, includeSubBranches: true };

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
  const reset = () => setFilters(INITIAL_FILTERS);
  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) =>
        !['pageNumber', 'pageSize', 'includeSubBranches'].includes(key) && value !== undefined && value !== ''
      ).length,
    [filters]
  );

  const person = (name?: string | null) => name || '—';
  const status = (row: ArrivalReportItem) =>
    (isAr ? row.contractStatusNameAr : row.contractStatusNameEn) || row.contractStatusNameAr || row.contractStatusNameEn || '—';
  const replacementStatus = (row: ArrivalReportItem) =>
    (isAr ? row.contractReplacementStatusAr : row.contractReplacementStatusEn) ||
    row.contractReplacementStatusAr ||
    row.contractReplacementStatusEn;

  return (
    <div className={contractStyles.contractsPage}>
      <div className={contractStyles.pageHeader}>
        <div className={contractStyles.headerContent}>
          <div className={contractStyles.headerTitle}>
            <FileTextOutlined className={contractStyles.headerIcon} />
            <div>
              <h1>{t('تقرير متابعة الوصول', 'Arrival Tracking Report')}</h1>
              <p className={contractStyles.headerSubtitle}>
                {t('متابعة وصول العاملات لعقود الاستقدام', 'Track worker arrivals for mediation contracts')}
              </p>
            </div>
          </div>
          <Button className={contractStyles.secondaryBtn} icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
            {t('تحديث النتائج', 'Refresh results')}
          </Button>
        </div>
      </div>

      <AdvancedFilterPanel
        activeCount={activeFilterCount}
        onClear={reset}
        contentLayout="block"
        quickFilters={
          <>
            <Input
              allowClear
              className={styles.searchInput}
              prefix={<SearchOutlined />}
              placeholder={t('بحث: عقد، مساند، تأشيرة، عميل أو عاملة', 'Search contract, Musaned, visa, customer or worker')}
              value={filters.search}
              onChange={(event) => update('search', event.target.value || undefined)}
            />
            <InputNumber
              min={1}
              className={styles.contractInput}
              placeholder={t('رقم العقد', 'Contract #')}
              value={filters.contractNumber}
              onChange={(value) => update('contractNumber', value ?? undefined)}
            />
            <RangePicker
              className={styles.arrivalRange}
              value={dateRange('arrivalDateFrom', 'arrivalDateTo')}
              onChange={(_, values) => setRange('arrivalDateFrom', 'arrivalDateTo', values)}
              placeholder={[t('الوصول من', 'Arrival from'), t('الوصول إلى', 'Arrival to')]}
            />
          </>
        }
      >
        <Row gutter={[12, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <label className={contractStyles.filterLabel}>{t('اسم العميل', 'Customer name')}</label>
            <Input allowClear value={filters.customerName} onChange={(event) => update('customerName', event.target.value || undefined)} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('رقم الجوال', 'Mobile number')}</label>
            <Input allowClear value={filters.mobileNumber} onChange={(event) => update('mobileNumber', event.target.value || undefined)} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('البريد الإلكتروني', 'Email')}</label>
            <Input allowClear value={filters.email} onChange={(event) => update('email', event.target.value || undefined)} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('رقم الهوية', 'ID number')}</label>
            <Input allowClear value={filters.idNumber} onChange={(event) => update('idNumber', event.target.value || undefined)} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('رقم التأشيرة', 'Visa number')}</label>
            <Input allowClear value={filters.visaNumber} onChange={(event) => update('visaNumber', event.target.value || undefined)} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('الجنسية', 'Nationality')}</label>
            <Select allowClear showSearch optionFilterProp="label" className={styles.fullWidth} value={filters.nationalityId} onChange={(value) => update('nationalityId', value)} options={nationalities.map((item) => ({ value: String(item.id), label: (isAr ? item.nationalityNameAr : item.nationalityNameEn) || item.nationalityNameAr || item.nationalityNameEn }))} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('الوكيل', 'Agent')}</label>
            <Select allowClear showSearch optionFilterProp="label" className={styles.fullWidth} value={filters.agentId} onChange={(value) => update('agentId', value)} options={agents.map((item) => ({ value: String(item.id), label: (isAr ? item.agentNameAr : item.agentNameEn) || item.agentNameAr || item.agentNameEn }))} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('حالة العقد', 'Contract status')}</label>
            <Select allowClear className={styles.fullWidth} value={filters.manualContractStatus} onChange={(value) => update('manualContractStatus', value)} options={MEDIATION_CONTRACT_STATUS.map((item) => ({ value: item.value, label: getEnumLabel([...MEDIATION_CONTRACT_STATUS], item.value, language) }))} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('الديانة', 'Religion')}</label>
            <Select allowClear className={styles.fullWidth} value={filters.religion} onChange={(value) => update('religion', value)} options={RELIGIONS.map((item) => ({ value: item.value, label: isAr ? item.ar : item.en }))} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('المهنة', 'Occupation')}</label>
            <Select allowClear showSearch optionFilterProp="label" className={styles.fullWidth} value={filters.jobId} onChange={(value) => update('jobId', value)} options={jobs.map((item) => ({ value: String(item.id), label: (isAr ? item.jobNameAr : item.jobNameEn) || item.jobNameAr || item.jobNameEn }))} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('نوع العقد', 'Contract type')}</label>
            <Select allowClear className={styles.fullWidth} value={filters.contractReplacementStatus} onChange={(value) => update('contractReplacementStatus', value)} options={[{ value: false, label: t('عادي', 'Normal') }, { value: true, label: t('بدل / نقل', 'Replacement / Transfer') }]} />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <label className={contractStyles.filterLabel}>{t('الضمان', 'Warranty')}</label>
            <Select allowClear className={styles.fullWidth} value={filters.guaranteeStatus} onChange={(value) => update('guaranteeStatus', value)} options={MEDIATION_CONTRACT_STATUS.map((item) => ({ value: item.value, label: getEnumLabel([...MEDIATION_CONTRACT_STATUS], item.value, language) }))} />
          </Col>
          <Col xs={24} md={12}>
            <label className={contractStyles.filterLabel}>{t('تاريخ التأشيرة', 'Visa date')}</label>
            <RangePicker className={styles.fullWidth} value={dateRange('visaDateFrom', 'visaDateTo')} onChange={(_, values) => setRange('visaDateFrom', 'visaDateTo', values)} />
          </Col>
          <Col xs={24} md={12}>
            <label className={contractStyles.filterLabel}>{t('تاريخ إنشاء العقد', 'Contract created date')}</label>
            <RangePicker className={styles.fullWidth} value={dateRange('createdDateFrom', 'createdDateTo')} onChange={(_, values) => setRange('createdDateFrom', 'createdDateTo', values)} />
          </Col>
        </Row>
      </AdvancedFilterPanel>

      <div className={styles.resultsHeader}>
        <div>
          <h2>{t('نتائج الوصول', 'Arrival results')}</h2>
          <span>{t('عرض أحدث حالات الوصول والعقود المرتبطة بها', 'Latest arrival status and linked contracts')}</span>
        </div>
        <Badge count={report?.totalCount ?? 0} showZero color="#003366" overflowCount={9999} />
      </div>

      {isLoading ? (
        <Card className={styles.loadingCard}><Spin size="large" /></Card>
      ) : report?.items?.length ? (
        <>
          <div className={styles.cardsGrid}>
            {report.items.map((row) => (
              <Card key={row.contractId} className={styles.arrivalCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.contractNumber}><FileTextOutlined /> #{row.contractNumber ?? '—'}</div>
                    <span className={styles.createdAt}>{t('أنشئ في', 'Created')} {toDate(row.createdAt)}</span>
                  </div>
                  <div className={styles.tags}>
                    <Tag color={row.hasArrived ? 'green' : 'gold'}>{isAr ? row.arrivalStatusAr || 'غير واصل' : row.arrivalStatusEn || 'Not arrived'}</Tag>
                    {replacementStatus(row) && <Tag color="blue">{replacementStatus(row)}</Tag>}
                  </div>
                </div>

                <div className={styles.peopleGrid}>
                  <div className={styles.personBlock}>
                    <Avatar className={styles.customerAvatar} icon={<UserOutlined />} />
                    <div><span>{t('العميل', 'Customer')}</span><strong>{person(row.customerName)}</strong><small>{row.customerMobile || row.customerEmail || row.customerNationalId || '—'}</small></div>
                  </div>
                  <div className={styles.personBlock}>
                    <Avatar className={styles.workerAvatar} icon={<IdcardOutlined />} />
                    <div><span>{t('العاملة', 'Worker')}</span><strong>{person(row.workerName)}</strong><small>{(isAr ? row.nationalityAr : row.nationalityEn) || row.nationalityAr || row.passportNumber || row.idNumber || '—'}</small></div>
                  </div>
                </div>

                <div className={styles.detailsGrid}>
                  <div><CalendarOutlined /><span>{t('الوصول', 'Arrival')}</span><strong>{toDate(row.arrivalDate)} {row.arrivalTime || ''}</strong></div>
                  <div><EnvironmentOutlined /><span>{t('الوجهة', 'Destination')}</span><strong>{row.arrivalDestination || '—'}</strong></div>
                  <div><IdcardOutlined /><span>{t('التأشيرة', 'Visa')}</span><strong>{row.visaNumber || '—'}</strong></div>
                  <div><SafetyCertificateOutlined /><span>{t('الضمان', 'Warranty')}</span><strong>{(isAr ? row.guaranteeStatusAr : row.guaranteeStatusEn) || row.guaranteeStatusAr || '—'}</strong></div>
                </div>

                <div className={styles.cardFooter}>
                  <div><Badge status={row.contractStatusId === 17 ? 'error' : 'processing'} text={status(row)} />{row.agentName && <span className={styles.agent}>{t('الوكيل:', 'Agent:')} {row.agentName}</span>}</div>
                  <Button type="primary" icon={<EyeOutlined />} onClick={() => router.push(`/contracts/mediationcontract/${row.contractId}`)}>{t('عرض العقد', 'View contract')}</Button>
                </div>
              </Card>
            ))}
          </div>
          <div className={styles.pagination}><Pagination current={filters.pageNumber} pageSize={filters.pageSize} total={report.totalCount} showSizeChanger showTotal={(total) => `${t('الإجمالي', 'Total')}: ${total}`} onChange={(pageNumber, pageSize) => setFilters((previous) => ({ ...previous, pageNumber, pageSize }))} /></div>
        </>
      ) : (
        <Card className={styles.emptyCard}><Empty description={t('لا توجد نتائج مطابقة للفلاتر المحددة', 'No arrivals match the selected filters')} /></Card>
      )}
    </div>
  );
}
