'use client';

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Card,
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
  Empty,
  Pagination,
  Spin,
} from 'antd';
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
  type JournalEntryLineDetail,
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

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');
  const formatAmount = (value?: number | null) => (Number(value) || 0).toLocaleString();
  const display = (value?: string | number | null) =>
    value !== undefined && value !== null && value !== '' ? value : '—';
  const contractDisplay = (record: JournalEntryListItem) =>
    display(record.contractNumber ?? record.sourceContractNumber);
  const displaySerial = (record: JournalEntryListItem, idx: number) =>
    record.serialNumber ?? (pageNumber - 1) * pageSize + idx + 1;
  const getLineRows = (record: JournalEntryListItem): JournalEntryLineDetail[] => {
    if (record.lines?.length) return record.lines;
    return [
      {
        accountId: `summary-${record.id}`,
        accountCode: '',
        accountName: t('ملخص القيد', 'Entry summary'),
        debit: record.totalDebit,
        credit: record.totalCredit,
        description: record.description || record.notes || null,
      },
    ];
  };

  const renderEntryNumberLink = (record: JournalEntryListItem) => {
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
          {record.entryNumber || '—'}
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
        {record.entryNumber || '—'}
      </a>
    );
  };

  const renderStatusTag = (statusValue: JournalEntryStatus) =>
    statusValue === JE_STATUS.Posted ? (
      <Tag icon={<CheckCircleFilled />} color="success">
        {t('معمد', 'Posted')}
      </Tag>
    ) : (
      <Tag icon={<CloseCircleFilled />} color="warning">
        {t('غير معمد', 'Draft')}
      </Tag>
    );

  const renderInfoItem = (label: string, value: ReactNode) => (
    <div className={styles.entryInfoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  const renderEntryActions = (record: JournalEntryListItem) => {
    const isDraft = record.status === JE_STATUS.Draft;
    const yearClosed = isYearClosed(record.date);
    return (
      <Space size={6} wrap className={styles.cardActions}>
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setDetailId(record.id)}
        >
          {t('عرض', 'View')}
        </Button>
        {accountingGates.canManage && isDraft && (
          <>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record.id)}
            >
              {t('تعديل', 'Edit')}
            </Button>
            <Tooltip
              title={
                yearClosed
                  ? t('السنة المالية مغلقة', 'Fiscal year is closed')
                  : t('اعتماد القيد', 'Post to ledger')
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
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={yearClosed}
                >
                  {t('اعتماد القيد', 'Post')}
                </Button>
              </Popconfirm>
            </Tooltip>
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
              <Button size="small" danger icon={<DeleteOutlined />}>
                {t('حذف', 'Delete')}
              </Button>
            </Popconfirm>
          </>
        )}
        {accountingGates.canManage && !isDraft && (
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
              <Button size="small" icon={<RollbackOutlined />} disabled={yearClosed}>
                {t('إلغاء الاعتماد', 'Unpost')}
              </Button>
            </Popconfirm>
          </Tooltip>
        )}
      </Space>
    );
  };

  const renderEntryCard = (record: JournalEntryListItem, idx: number) => {
    const lines = getLineRows(record);
    return (
      <article key={record.id} className={styles.journalEntryCard}>
        <div className={styles.entryCardBody}>
          <aside className={styles.entryCardMeta}>
            <div className={styles.entryMetaTop}>
              {renderStatusTag(record.status)}
              <Tag color="blue">{getSourceLabel(record.source, isAr)}</Tag>
            </div>
            <div className={styles.entrySerial}>{displaySerial(record, idx)}</div>
            <div className={styles.entrySerialLabel}>{t('الرقم المتسلسل', 'Serial Number')}</div>
            <div className={styles.entryMetaStack}>
              <div>
                <span>{t('رقم القيد', 'Entry No.')}</span>
                <strong>{renderEntryNumberLink(record)}</strong>
              </div>
              <div>
                <span>{t('التاريخ', 'Date')}</span>
                <strong>{formatDate(record.date)}</strong>
              </div>
            </div>
          </aside>

          <section className={styles.entryVoucherPanel}>
            <div className={styles.entryVoucherHeader}>
              <div>
                <div className={styles.entryVoucherTitle}>
                  {record.description || record.notes || t('قيد يومية', 'Journal Entry')}
                </div>
                <div className={styles.entryVoucherSubtitle}>
                  {t('نوع التقييد', 'Restriction Type')}: {display(record.restrictionTypeId ? restrictionLabel.get(record.restrictionTypeId) : null)}
                </div>
              </div>
              <div className={styles.entryTotalsCompact}>
                <span>{t('مدين', 'Debit')}: <strong>{formatAmount(record.totalDebit)}</strong></span>
                <span>{t('دائن', 'Credit')}: <strong className={record.isBalanced ? undefined : styles.unbalancedAmount}>{formatAmount(record.totalCredit)}</strong></span>
              </div>
            </div>

            <div className={styles.entryInfoGrid}>
              {renderInfoItem(t('رقم العقد', 'Contract No.'), contractDisplay(record))}
              {renderInfoItem(t('رقم مساند', 'Musaned #'), display(record.musanedContractNumber))}
              {renderInfoItem(t('الجهة المرتبطة', 'Related To'), display(record.customerName || record.customerId))}
              {renderInfoItem(t('الوكيل', 'Agent'), display(record.agentName || record.agentId))}
              {renderInfoItem(t('العاملة', 'Worker'), display(record.workerName || record.workerId))}
              {renderInfoItem(t('الموظف', 'Employee'), display(record.employeeName || record.employeeId))}
            </div>

            <div className={styles.voucherTableScroll}>
              <table className={styles.voucherTable}>
                <thead>
                  <tr>
                    <th>{t('م', '#')}</th>
                    <th>{t('اسم الحساب', 'Account')}</th>
                    <th>{t('مدين', 'Debit')}</th>
                    <th>{t('دائن', 'Credit')}</th>
                    <th>{t('الوصف', 'Description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, lineIdx) => (
                    <tr key={line.id ?? `${record.id}-${lineIdx}`}>
                      <td className={styles.lineSerial}>{lineIdx + 1}</td>
                      <td>
                        <span className={styles.lineAccountCode}>{line.accountCode || '—'}</span>
                        <span className={styles.lineAccountName}>{line.accountName || '—'}</span>
                      </td>
                      <td className={styles.moneyCell}>
                        {line.debit ? <span className={styles.amount}>{formatAmount(line.debit)}</span> : <span className={styles.muted}>—</span>}
                      </td>
                      <td className={styles.moneyCell}>
                        {line.credit ? <span className={styles.amount}>{formatAmount(line.credit)}</span> : <span className={styles.muted}>—</span>}
                      </td>
                      <td>{line.description || record.description || <span className={styles.muted}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>{t('إجمالي', 'Total')}</td>
                    <td className={styles.moneyCell}>{formatAmount(record.totalDebit)}</td>
                    <td className={styles.moneyCell}>{formatAmount(record.totalCredit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className={styles.entryCardFooter}>
              {renderEntryActions(record)}
            </div>
          </section>
        </div>
      </article>
    );
  };

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
            <label className={styles.filterLabel}>{t('الجهة المرتبطة', 'Related To')}</label>
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
              placeholder={t('الجهة المرتبطة', 'Related To')}
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

      {/* ── Voucher cards ────────────────────────────────────── */}
      <Card className={styles.resultsCard}>
        {isLoading || isFetching ? (
          <div className={styles.loadingState}>
            <Spin size="large" />
          </div>
        ) : items.length === 0 ? (
          <Empty description={t('لا توجد قيود', 'No journal entries')} />
        ) : (
          <div className={styles.journalCardList}>
            {items.map((record, idx) => renderEntryCard(record, idx))}
          </div>
        )}
        <div className={styles.paginationBar}>
          <Pagination
            current={pageNumber}
            pageSize={pageSize}
            total={totalCount}
            showSizeChanger
            pageSizeOptions={[10, 15, 20, 25, 50, 100]}
            showTotal={(total) => t(`الإجمالي: ${total}`, `Total: ${total}`)}
            onChange={(page, size) => {
              setPageNumber(page);
              setPageSize(size);
            }}
          />
        </div>
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
