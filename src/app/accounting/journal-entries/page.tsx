'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Card,
  Table,
  Input,
  InputNumber,
  Select,
  Button,
  Tag,
  Space,
  Tooltip,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  BookOutlined,
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import {
  useJournalEntries,
  useJournalEntryLookups,
  useJournalEntryMutations,
} from '@/hooks/api/useJournalEntries';
import { useRestrictionTypes } from '@/hooks/api/useRestrictionTypes';
import { useClosedYears } from '@/hooks/api/usePeriodClosing';
import { useCustomers } from '@/hooks/api/useCustomers';
import { useHREmployees } from '@/hooks/api/useHR';
import { useAuthStore } from '@/store/authStore';
import { AdvancedFilterPanel, BranchFilterSelect, DateRangeFilter } from '@/components/filters';
import {
  JOURNAL_STATUSES,
  JOURNAL_SOURCES,
  JOURNAL_SORT_BY,
  JOURNAL_SORT_DIRECTION,
  JE_STATUS,
  JE_SOURCE,
  getSourceLabel,
  type JournalEntryLookupOption,
  type JournalEntryListItem,
  type JournalEntryStatus,
  type JournalEntrySource,
} from '@/types/journal-entry.types';
import { useRouter, useSearchParams } from 'next/navigation';
import { message } from 'antd';
import {
  resolveJournalEntryNavigation,
  resolveContractRoute,
  buildSourceUrl,
  type JournalEntryNavInput,
} from '@/lib/journal-entry-navigation';
import { linkProps } from '@/lib/navigation/linkProps';
import { reserveNewTab } from '@/lib/navigation/openInNewTab';
import { EntryFormDrawer } from './_components/EntryFormDrawer';
import { EntryDetailDrawer } from './_components/EntryDetailDrawer';
import { useAccountingActionGates } from '@/hooks/useActionPermissionGates';
import styles from './JournalEntries.module.css';

export default function JournalEntriesPage() {
  const language = useAuthStore((state) => state.language);
  const isAr = language !== 'en';
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const accountingGates = useAccountingActionGates();
  const searchParams = useSearchParams();
  const openIdParam = searchParams.get('openId');
  const entryNumberParam = searchParams.get('entryNumber');

  // ── Query state ─────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced, server-side
  const [status, setStatus] = useState<JournalEntryStatus | undefined>();
  const [entryType, setEntryType] = useState<JournalEntrySource | undefined>();
  const [contractType, setContractType] = useState<number | undefined>();
  const [contractNumber, setContractNumber] = useState<number | undefined>();
  const [musanedContractNumber, setMusanedContractNumber] = useState<string | undefined>();
  const [exactEntryNumber, setExactEntryNumber] = useState<string | undefined>(
    entryNumberParam ?? undefined
  );
  const [branchId, setBranchId] = useState<string | undefined>();
  const [includeSubBranches, setIncludeSubBranches] = useState(true);
  const [range, setRange] = useState<[string | undefined, string | undefined]>([
    dayjs().subtract(1, 'month').startOf('day').toISOString(),
    dayjs().endOf('day').toISOString(),
  ]);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<number>(JOURNAL_SORT_BY.Date);
  const [sortDirection, setSortDirection] = useState<number>(JOURNAL_SORT_DIRECTION.Desc);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce the search box into the server-side `search` param (400ms).
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNumber(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { restrictionTypes } = useRestrictionTypes();
  const { data: lookups } = useJournalEntryLookups();
  // Posting/unposting is blocked by the backend inside a closed fiscal year;
  // gate those actions in the UI too (fails open if the list is unavailable).
  const { isYearClosed } = useClosedYears();
  const { customers = [] } = useCustomers();
  const { employees = [] } = useHREmployees({ PageSize: 200 });

  const { items, totalCount, isLoading, isFetching, refetch } = useJournalEntries({
    pageNumber,
    pageSize,
    // `notes` is a contains filter over description/notes in POST /search.
    notes: search || undefined,
    status,
    entryType,
    contractType,
    contractNumber,
    musanedContractNumber,
    entryNumber: exactEntryNumber,
    branchId,
    includeSubBranches: branchId ? includeSubBranches : undefined,
    createdFrom: range[0],
    createdTo: range[1],
    relatedToId: customerId,
    employeeId,
    sortBy,
    sortDirection,
  });

  const { deleteEntry, postEntry, unpostEntry, isDeleting, isPosting, isUnposting } =
    useJournalEntryMutations();

  // ── Drawers ─────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(
    null
  );

  const openCreate = () => {
    if (!accountingGates.canCreate) return;
    setFormState({ mode: 'create' });
  };
  const openEdit = (id: string) => {
    if (!accountingGates.canUpdate) return;
    setDetailId(null);
    setFormState({ mode: 'edit', id });
  };

  // ── Row → source-document navigation ────────────────────────
  // Clicking a row navigates to the entry's source (contract / voucher / …).
  // The entry-number link and the action buttons keep their own behaviour
  // (they're skipped via the interactive-target guard in `onRow`).
  const router = useRouter();
  const navInput = (record: JournalEntryListItem): JournalEntryNavInput => ({
    source: record.source,
    referenceType: record.referenceType,
    sourceId: record.sourceId,
    customerId: record.customerId,
    agentId: record.agentId,
    workerId: record.workerId,
    employeeId: record.employeeId,
  });
  /** True when this entry has a screen we can navigate to. */
  const isNavigable = (record: JournalEntryListItem): boolean => {
    const nav = resolveJournalEntryNavigation(navInput(record));
    return !!nav.route && !nav.disabled;
  };
  const isNewTabIntent = (e: MouseEvent<HTMLElement>) =>
    e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
  const goToSource = async (record: JournalEntryListItem, openInTab = false) => {
    const nav = resolveJournalEntryNavigation(navInput(record));
    if (!nav.route || nav.disabled) return;
    const reservedTab = openInTab ? reserveNewTab() : null;
    try {
      let route = nav.route;
      if (nav.needsContractResolve && nav.id) {
        route = await resolveContractRoute(nav.id);
      }
      const url = buildSourceUrl(route, nav.id, nav.pathParam);
      if (reservedTab) {
        reservedTab.navigate(url);
      } else {
        router.push(url);
      }
    } catch {
      reservedTab?.close();
      message.error(t('تعذّر فتح المصدر', 'Could not open the source'));
    }
  };

  const restrictionLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of restrictionTypes) map.set(r.id, r.nameAr || r.name || r.id);
    return map;
  }, [restrictionTypes]);

  const lookupLabel = (option: JournalEntryLookupOption) =>
    (isAr ? option.nameAr : option.nameEn) || option.name || option.nameAr || option.nameEn || String(option.value);
  const entryStatusOptions =
    lookups?.entryStatuses?.length
      ? lookups.entryStatuses.map((s) => ({ value: s.value, label: lookupLabel(s) }))
      : JOURNAL_STATUSES.map((s) => ({ value: s.value, label: isAr ? s.ar : s.en }));
  const entryTypeOptions =
    lookups?.entryTypes?.length
      ? lookups.entryTypes.map((s) => ({ value: s.value, label: lookupLabel(s) }))
      : JOURNAL_SOURCES.map((s) => ({ value: s.value, label: isAr ? s.ar : s.en }));
  const contractTypeOptions =
    lookups?.contractTypes?.length
      ? lookups.contractTypes.map((s) => ({ value: s.value, label: lookupLabel(s) }))
      : [
          { value: 1, label: t('عقد جديد', 'New') },
          { value: 2, label: t('نقل', 'Transfer') },
          { value: 3, label: t('تجديد', 'Renewal') },
        ];
  const sortByOptions =
    lookups?.sortByOptions?.length
      ? lookups.sortByOptions.map((s) => ({ value: s.value, label: lookupLabel(s) }))
      : [
          { value: JOURNAL_SORT_BY.Date, label: t('التاريخ', 'Date') },
          { value: JOURNAL_SORT_BY.EntryNumber, label: t('رقم القيد', 'Entry No.') },
          { value: JOURNAL_SORT_BY.ContractNumber, label: t('رقم العقد', 'Contract No.') },
          { value: JOURNAL_SORT_BY.Status, label: t('الحالة', 'Status') },
          { value: JOURNAL_SORT_BY.SerialNumber, label: t('الرقم المتسلسل', 'Serial #') },
        ];
  const sortDirectionOptions =
    lookups?.sortDirections?.length
      ? lookups.sortDirections.map((s) => ({ value: s.value, label: lookupLabel(s) }))
      : [
          { value: JOURNAL_SORT_DIRECTION.Asc, label: t('تصاعدي', 'Ascending') },
          { value: JOURNAL_SORT_DIRECTION.Desc, label: t('تنازلي', 'Descending') },
        ];

  useEffect(() => {
    if (openIdParam) setDetailId(openIdParam);
  }, [openIdParam]);

  useEffect(() => {
    if (!entryNumberParam) return;
    setExactEntryNumber(entryNumberParam);
    setSearchInput(entryNumberParam);
    setSearch(entryNumberParam);
    setPageNumber(1);
  }, [entryNumberParam]);

  useEffect(() => {
    if (!entryNumberParam || detailId || items.length === 0) return;
    const exact = items.find((item) => item.entryNumber === entryNumberParam) ?? items[0];
    if (exact?.id) setDetailId(exact.id);
  }, [detailId, entryNumberParam, items]);

  // Search + Branch are quick filters and stay untouched by Clear, matching
  // the AdvancedFilterPanel convention used app-wide. Everything below is an
  // "advanced" field: Clear returns each to its mount-time default (the date
  // range back to the last-month window, not to empty — that's this page's
  // baseline "no explicit filter" state).
  const activeFilterCount = [
    status,
    entryType,
    contractType,
    contractNumber,
    musanedContractNumber,
    exactEntryNumber,
    customerId,
    employeeId,
    range[0],
    sortBy !== JOURNAL_SORT_BY.Date ? sortBy : undefined,
    sortDirection !== JOURNAL_SORT_DIRECTION.Desc ? sortDirection : undefined,
  ].filter((v) => v !== undefined && v !== null && v !== '').length;

  const clearFilters = () => {
    setStatus(undefined);
    setEntryType(undefined);
    setContractType(undefined);
    setContractNumber(undefined);
    setMusanedContractNumber(undefined);
    setExactEntryNumber(undefined);
    setRange([
      dayjs().subtract(1, 'month').startOf('day').toISOString(),
      dayjs().endOf('day').toISOString(),
    ]);
    setCustomerId(undefined);
    setEmployeeId(undefined);
    setSortBy(JOURNAL_SORT_BY.Date);
    setSortDirection(JOURNAL_SORT_DIRECTION.Desc);
    setPageNumber(1);
  };

  // ── Metrics (current page snapshot) ─────────────────────────
  const draftCount = items.filter((e) => e.status === JE_STATUS.Draft).length;
  const postedCount = items.filter((e) => e.status === JE_STATUS.Posted).length;
  const systemCount = items.filter((e) => e.source !== JE_SOURCE.Manual).length;

  // ── Columns ─────────────────────────────────────────────────
  const columns: ColumnsType<JournalEntryListItem> = [
    {
      title: '#',
      key: 'serialNumber',
      width: 78,
      render: (_, record, idx) => record.serialNumber ?? (pageNumber - 1) * pageSize + idx + 1,
    },
    {
      title: t('رقم القيد', 'Entry No.'),
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 120,
      render: (v: string, record) => {
        // Entry number goes to the source document (like the whole row). Manual
        // entries have no source, so there it opens the JE detail instead.
        // The eye icon (Actions) always opens the JE detail.
        const nav = resolveJournalEntryNavigation(navInput(record));
        const navigable = !!nav.route && !nav.disabled;
        const href =
          navigable && !nav.needsContractResolve
            ? buildSourceUrl(nav.route as string, nav.id, nav.pathParam)
            : null;
        const activate = () => (navigable ? void goToSource(record) : setDetailId(record.id));
        if (href) {
          return (
            <a className={styles.entryNumber} {...linkProps(href, router)}>
              {v || '—'}
            </a>
          );
        }
        return (
          <a
            role="button"
            tabIndex={0}
            className={styles.entryNumber}
            onClick={(e) => {
              if (navigable) {
                e.preventDefault();
                void goToSource(record, isNewTabIntent(e));
                return;
              }
              activate();
            }}
            onAuxClick={(e) => {
              if (navigable && e.button === 1) {
                e.preventDefault();
                void goToSource(record, true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
              }
            }}
          >
            {v || '—'}
          </a>
        );
      },
    },
    {
      title: t('رقم العقد', 'Contract No.'),
      key: 'sourceContractNumber',
      width: 120,
      render: (_, record) =>
        record.contractNumber ?? record.sourceContractNumber ? (
          <Tag color="geekblue">#{record.contractNumber ?? record.sourceContractNumber}</Tag>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: t('التاريخ', 'Date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
    {
      title: t('ألى', 'Related To'),
      key: 'relatedTo',
      width: 160,
      render: (_, record) => record.customerName || record.customerId || <span className={styles.muted}>—</span>,
    },
    {
      title: t('الموظف', 'Employee'),
      key: 'employee',
      width: 150,
      render: (_, record) => record.employeeName || record.employeeId || <span className={styles.muted}>—</span>,
    },
    {
      title: t('الوصف', 'Description'),
      dataIndex: 'description',
      key: 'description',
      width: 240,
      render: (v: string) => <span className={styles.description}>{v || '—'}</span>,
    },
    {
      title: t('نوع القيد', 'Entry Type'),
      dataIndex: 'source',
      key: 'source',
      width: 130,
      render: (v: JournalEntrySource) => (
        <span className={styles.muted}>{getSourceLabel(v, isAr)}</span>
      ),
    },
    {
      title: t('نوع التقييد', 'Restriction Type'),
      dataIndex: 'restrictionTypeId',
      key: 'restrictionTypeId',
      width: 140,
      render: (id: string | null) =>
        id ? (
          <Tag color="purple">{restrictionLabel.get(id) ?? '—'}</Tag>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: t('مدين', 'Debit'),
      dataIndex: 'totalDebit',
      key: 'totalDebit',
      width: 120,
      align: 'right',
      render: (v: number) => <span className={styles.amount}>{v.toLocaleString()}</span>,
    },
    {
      title: t('دائن', 'Credit'),
      dataIndex: 'totalCredit',
      key: 'totalCredit',
      width: 120,
      align: 'right',
      render: (v: number, record) => (
        <span className={record.isBalanced ? styles.amount : styles.unbalancedAmount}>
          {v.toLocaleString()}
        </span>
      ),
    },
    {
      title: t('الحالة', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: JournalEntryStatus) =>
        v === JE_STATUS.Posted ? (
          <Tag icon={<CheckCircleFilled />} color="success">
            {t('معمد', 'Posted')}
          </Tag>
        ) : (
          <Tag icon={<CloseCircleFilled />} color="warning">
            {t('غير معمد', 'Draft')}
          </Tag>
        ),
    },
    {
      title: t('رقم مساند', 'Musaned #'),
      dataIndex: 'musanedContractNumber',
      key: 'musanedContractNumber',
      width: 130,
      render: (v: string | null) => v || <span className={styles.muted}>—</span>,
    },
    {
      title: t('إجراءات', 'Actions'),
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        const isDraft = record.status === JE_STATUS.Draft;
        const yearClosed = isYearClosed(record.date);
        return (
          <Space size={2}>
            <Tooltip title={t('عرض', 'View')}>
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={() => setDetailId(record.id)}
              />
            </Tooltip>
            {isDraft ? (
              <>
                {accountingGates.canManage && (
                  <>
                    <Tooltip title={t('تعديل', 'Edit')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(record.id)}
                      />
                    </Tooltip>
                    <Tooltip
                      title={
                        yearClosed
                          ? t('السنة المالية مغلقة', 'Fiscal year is closed')
                          : t('اعتماد', 'Post')
                      }
                    >
                      <Popconfirm
                        title={t('اعتماد القيد؟', 'Post this entry?')}
                        description={t(
                          'سيتم ترحيل الحركات إلى الأستاذ العام.',
                          'Ledger movements will be written for all lines.'
                        )}
                        okText={t('اعتماد', 'Post')}
                        cancelText={t('إلغاء', 'Cancel')}
                        okButtonProps={{ loading: isPosting, disabled: !record.isBalanced }}
                        onConfirm={() => void postEntry(record.id).catch(() => {})}
                        disabled={yearClosed}
                      >
                        <Button
                          size="small"
                          type="text"
                          style={yearClosed ? undefined : { color: '#52c41a' }}
                          icon={<CheckCircleOutlined />}
                          disabled={yearClosed}
                        />
                      </Popconfirm>
                    </Tooltip>
                    <Tooltip title={t('حذف', 'Delete')}>
                      <Popconfirm
                        title={t('حذف القيد؟', 'Delete this entry?')}
                        description={t(
                          'سيتم حذف القيد نهائيًا. لا يمكن التراجع.',
                          'This draft entry will be permanently deleted.'
                        )}
                        okText={t('حذف', 'Delete')}
                        cancelText={t('إلغاء', 'Cancel')}
                        okButtonProps={{ danger: true, loading: isDeleting }}
                        onConfirm={() => void deleteEntry(record.id).catch(() => {})}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Tooltip>
                  </>
                )}
              </>
            ) : (
              accountingGates.canManage && (
                <Tooltip
                  title={
                    yearClosed
                      ? t('السنة المالية مغلقة', 'Fiscal year is closed')
                      : t('إلغاء الاعتماد', 'Unpost')
                  }
                >
                  <Popconfirm
                    title={t('إلغاء اعتماد القيد؟', 'Unpost this entry?')}
                    description={t(
                      'سيتم عكس الحركات وإعادة القيد إلى مسودة.',
                      'Ledger movements will be reversed; entry returns to Draft.'
                    )}
                    okText={t('إلغاء الاعتماد', 'Unpost')}
                    cancelText={t('رجوع', 'Back')}
                    okButtonProps={{ loading: isUnposting }}
                    onConfirm={() => void unpostEntry(record.id).catch(() => {})}
                    disabled={yearClosed}
                  >
                    <Button
                      size="small"
                      type="text"
                      style={yearClosed ? undefined : { color: '#fa8c16' }}
                      icon={<RollbackOutlined />}
                      disabled={yearClosed}
                    />
                  </Popconfirm>
                </Tooltip>
              )
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.page}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <BookOutlined className={styles.headerIcon} />
            <div>
              <h1 className={styles.pageTitle}>{t('قيود اليومية', 'Journal Entries')}</h1>
              <p className={styles.pageSubtitle}>
                {t(
                  'إنشاء واعتماد القيود المحاسبية ومراجعة حركاتها',
                  'Create, post and review manual accounting entries'
                )}
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
              className={styles.refreshBtn}
            >
              {t('تحديث', 'Refresh')}
            </Button>
            {accountingGates.canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
                className={styles.addBtn}
              >
                {t('قيد جديد', 'Add Entry')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────── */}
      <div className={styles.metrics}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{t('الإجمالي', 'Total')}</div>
          <div className={styles.metricValue}>{totalCount.toLocaleString()}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.draft}`}>
          <div className={styles.metricLabel}>{t('غير معمدة (الصفحة)', 'Draft (page)')}</div>
          <div className={styles.metricValue}>{draftCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.posted}`}>
          <div className={styles.metricLabel}>{t('معمدة (الصفحة)', 'Posted (page)')}</div>
          <div className={styles.metricValue}>{postedCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.system}`}>
          <div className={styles.metricLabel}>{t('آلية (الصفحة)', 'System (page)')}</div>
          <div className={styles.metricValue}>{systemCount}</div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <AdvancedFilterPanel
        activeCount={activeFilterCount}
        onClear={clearFilters}
        contentLayout="block"
        quickFilters={
          <>
            <Input
              allowClear
              size="large"
              prefix={<SearchOutlined />}
              placeholder={t('ابحث بالوصف أو رقم القيد...', 'Search by description or entry no...')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: 280 }}
            />
            <BranchFilterSelect
              value={branchId}
              onChange={(v) => {
                setBranchId(v);
                setPageNumber(1);
              }}
              includeSubBranches={includeSubBranches}
              onIncludeSubBranchesChange={setIncludeSubBranches}
            />
          </>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('الحالة', 'Status')}</label>
            <Select
              size="large"
              allowClear
              style={{ width: '100%' }}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPageNumber(1);
              }}
              placeholder={t('الحالة', 'Status')}
              options={entryStatusOptions}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('نوع القيد', 'Entry Type')}</label>
            <Select
              size="large"
              allowClear
              style={{ width: '100%' }}
              value={entryType}
              onChange={(v) => {
                setEntryType(v);
                setPageNumber(1);
              }}
              placeholder={t('نوع القيد', 'Entry Type')}
              options={entryTypeOptions}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('تاريخ الإنشاء', 'Created Date')}</label>
            <DateRangeFilter
              value={range}
              onChange={(v) => {
                setRange(v);
                setPageNumber(1);
              }}
              placeholder={[t('من', 'From'), t('إلى', 'To')]}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('رقم العقد', 'Contract No.')}</label>
            <InputNumber
              min={1}
              precision={0}
              controls={false}
              size="large"
              style={{ width: '100%' }}
              value={contractNumber ?? null}
              onChange={(v) => {
                setContractNumber(v ? Number(v) : undefined);
                setPageNumber(1);
              }}
              placeholder={t('رقم العقد', 'Contract No.')}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('رقم العقد في مساند', 'Musaned Contract No.')}</label>
            <Input
              allowClear
              size="large"
              style={{ width: '100%' }}
              value={musanedContractNumber}
              onChange={(e) => {
                setMusanedContractNumber(e.target.value || undefined);
                setPageNumber(1);
              }}
              placeholder={t('رقم العقد في مساند', 'Musaned Contract No.')}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('رقم القيد', 'Entry No.')}</label>
            <Input
              allowClear
              size="large"
              style={{ width: '100%' }}
              value={exactEntryNumber}
              onChange={(e) => {
                setExactEntryNumber(e.target.value || undefined);
                setPageNumber(1);
              }}
              placeholder={t('رقم القيد', 'Entry No.')}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('نوع العقد', 'Contract Type')}</label>
            <Select
              allowClear
              size="large"
              style={{ width: '100%' }}
              value={contractType}
              onChange={(v) => {
                setContractType(v);
                setPageNumber(1);
              }}
              placeholder={t('نوع العقد', 'Contract Type')}
              options={contractTypeOptions}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('ألى', 'Related To')}</label>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              size="large"
              style={{ width: '100%' }}
              value={customerId}
              onChange={(v) => {
                setCustomerId(v);
                setPageNumber(1);
              }}
              placeholder={t('ألى', 'Related To')}
              options={(customers as any[]).map((c: any) => ({
                value: c.id,
                label: (isAr ? c.arabicName || c.englishName : c.englishName || c.arabicName) || String(c.id),
              }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('الموظف', 'Employee')}</label>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              size="large"
              style={{ width: '100%' }}
              value={employeeId}
              onChange={(v) => {
                setEmployeeId(v);
                setPageNumber(1);
              }}
              placeholder={t('الموظف', 'Employee')}
              options={(employees as any[]).map((e: any) => ({
                value: String(e.id),
                label: e.nameAr || e.nameEn || e.employeeName || String(e.id),
              }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('ترتيب حسب', 'Sort By')}</label>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={sortBy}
              onChange={(v) => {
                setSortBy(v);
                setPageNumber(1);
              }}
              options={sortByOptions}
            />
          </Col>
          <Col xs={24} md={6}>
            <label className={styles.filterLabel}>{t('اتجاه الترتيب', 'Sort Direction')}</label>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={sortDirection}
              onChange={(v) => {
                setSortDirection(v);
                setPageNumber(1);
              }}
              options={sortDirectionOptions}
            />
          </Col>
        </Row>
      </AdvancedFilterPanel>

      {/* ── Table ────────────────────────────────────────────── */}
      <Card className={styles.tableCard}>
        <Table<JournalEntryListItem>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={isLoading || isFetching}
          size="middle"
          bordered
          scroll={{ x: 1300 }}
          onRow={(record) => {
            const navigable = isNavigable(record);
            return {
              className: navigable ? styles.sourceRow : undefined,
              onClick: (e) => {
                // Let the entry-number link, action buttons, and any other
                // interactive control handle their own clicks.
                if ((e.target as HTMLElement).closest('a, button, .ant-btn, .ant-popover, input, .ant-select')) {
                  return;
                }
                if (navigable) void goToSource(record);
              },
            };
          }}
          pagination={{
            current: pageNumber,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: [10, 15, 20, 25, 50, 100],
            showTotal: (total) => t(`الإجمالي: ${total}`, `Total: ${total}`),
            onChange: (page, size) => {
              setPageNumber(page);
              setPageSize(size);
            },
          }}
        />
      </Card>

      {/* ── Drawers ──────────────────────────────────────────── */}
      <EntryDetailDrawer
        open={!!detailId}
        entryId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={accountingGates.canUpdate ? openEdit : undefined}
      />
      {formState && (
        <EntryFormDrawer
          open
          mode={formState.mode}
          entryId={formState.id}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
