import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/config/api.config';
import {
  normalizeStatus,
  normalizeSource,
  normalizeReferenceType,
  type JournalEntriesQuery,
  type JournalEntriesPage,
  type JournalEntryListItem,
  type JournalEntryDetail,
  type JournalEntryLineDetail,
  type JournalEntryInput,
  type JournalEntryLookups,
} from '@/types/journal-entry.types';

/**
 * Journal Entries service.
 *
 * The backend wraps every payload in an ApiResponse envelope
 * `{ success, statusCode, message, data }` and may serialise nested arrays as
 * `{ $values: [...] }` (System.Text.Json reference handling). Both shapes are
 * normalised here. See JournalEntries-endpoint.pdf for the full contract.
 */
export class JournalEntryService {
  /** Pull the meaningful payload out of the ApiResponse envelope. */
  private static unwrap<T>(payload: any): T {
    const inner = payload?.data?.value ?? payload?.value ?? payload?.data ?? payload;
    return inner as T;
  }

  /** Coerce a value that may be an array or a `{ $values: [] }` wrapper. */
  private static asArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.$values)) return value.$values;
    return [];
  }

  private static num(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private static dateOnly(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || undefined;
    return date.toISOString().slice(0, 10);
  }

  /** Map a raw list/detail summary into a clean JournalEntryListItem. */
  private static toListItem(raw: any): JournalEntryListItem {
    const totalDebit = this.num(raw?.totalDebit);
    const totalCredit = this.num(raw?.totalCredit);
    return {
      id: raw?.id,
      serialNumber:
        raw?.serialNumber != null && Number.isFinite(Number(raw.serialNumber))
          ? Number(raw.serialNumber)
          : null,
      entryNumber: raw?.entryNumber ?? '',
      date: raw?.date ?? '',
      description: raw?.description ?? raw?.notes ?? '',
      notes: raw?.notes ?? raw?.description ?? null,
      status: normalizeStatus(raw?.status),
      source: normalizeSource(raw?.source ?? raw?.entryType),
      entryType: normalizeSource(raw?.entryType ?? raw?.source),
      referenceType: normalizeReferenceType(raw?.referenceType),
      sourceId: raw?.sourceId ?? null,
      totalDebit,
      totalCredit,
      isBalanced:
        typeof raw?.isBalanced === 'boolean'
          ? raw.isBalanced
          : Math.round((totalDebit - totalCredit) * 100) === 0,
      restrictionTypeId: raw?.restrictionTypeId ?? null,
      sourceContractNumber:
        raw?.contractNumber ??
        raw?.sourceContractNumber ??
        raw?.referenceContractNumber ??
        raw?.contractNo ??
        null,
      contractNumber:
        raw?.contractNumber ??
        raw?.sourceContractNumber ??
        raw?.referenceContractNumber ??
        raw?.contractNo ??
        null,
      musanedContractNumber: raw?.musanedContractNumber ?? null,
      contractType: raw?.contractType ?? null,
      customerId: raw?.customerId ?? raw?.relatedToId ?? null,
      customerName: raw?.customerName ?? raw?.customerNameAr ?? raw?.customerNameEn ?? null,
      agentId: raw?.agentId ?? null,
      agentName: raw?.agentName ?? raw?.agentNameAr ?? raw?.agentNameEn ?? null,
      workerId: raw?.workerId ?? null,
      workerName: raw?.workerName ?? raw?.workerNameAr ?? raw?.workerNameEn ?? null,
      employeeId: raw?.employeeId ?? null,
      employeeName: raw?.employeeName ?? raw?.employeeNameAr ?? raw?.employeeNameEn ?? null,
      createdBy: raw?.createdBy ?? null,
      createdDate: raw?.createdDate ?? null,
      lines: this.asArray(raw?.lines ?? raw?.lines?.$values).map((l) => this.toLine(l)),
    };
  }

  private static toLine(raw: any): JournalEntryLineDetail {
    return {
      accountId: raw?.accountId,
      accountCode: raw?.accountCode ?? '',
      accountName: raw?.accountName ?? '',
      debit: this.num(raw?.debit),
      credit: this.num(raw?.credit),
      description: raw?.description ?? null,
    };
  }

  // ==================== Reads ====================

  private static toSearchBody(query: JournalEntriesQuery = {}) {
    return {
      entryNumber: query.entryNumber || null,
      entryNumberMatch: query.entryNumberMatch ?? undefined,
      createdDate: this.dateOnly(query.createdDate),
      createdFrom: this.dateOnly(query.createdFrom ?? query.createdDateFrom ?? query.from),
      createdTo: this.dateOnly(query.createdTo ?? query.createdDateTo ?? query.to),
      employeeId: query.employeeId || null,
      entryStatus: query.entryStatus ?? query.status ?? null,
      contractNumber:
        query.contractNumber != null && query.contractNumber !== ''
          ? String(query.contractNumber)
          : null,
      musanedContractNumber: query.musanedContractNumber || null,
      contractType: query.contractType ?? null,
      entryType: query.entryType ?? query.source ?? null,
      notes: query.notes ?? query.search ?? null,
      relatedToId: query.relatedToId ?? query.customerId ?? null,
      sortBy: typeof query.sortBy === 'number' ? query.sortBy : 0,
      sortDirection:
        query.sortDirection ??
        (query.sortDescending === false ? 0 : 1),
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 10,
      branchId: query.branchId || null,
      includeSubBranches: query.branchId ? query.includeSubBranches ?? true : true,
    };
  }

  /** GET /JournalEntries/lookups — dropdown metadata for the search filters. */
  static async getLookups(): Promise<JournalEntryLookups> {
    const response = await api.get<any>(API_ENDPOINTS.JOURNAL_ENTRIES.LOOKUPS);
    const data = this.unwrap<any>(response.data);
    return {
      entryStatuses: this.asArray(data?.entryStatuses),
      entryTypes: this.asArray(data?.entryTypes),
      contractTypes: this.asArray(data?.contractTypes),
      sortByOptions: this.asArray(data?.sortByOptions),
      sortDirections: this.asArray(data?.sortDirections),
    };
  }

  /** POST /JournalEntries/search — paginated + filtered list. */
  static async getAll(query: JournalEntriesQuery = {}): Promise<JournalEntriesPage> {
    const requestedPageSize = query.pageSize ?? 10;
    const response = await api.post<any>(
      API_ENDPOINTS.JOURNAL_ENTRIES.SEARCH,
      this.toSearchBody(query)
    );
    const data = this.unwrap<any>(response.data);
    const rawItems = this.asArray(data?.items ?? data?.$values ?? data);
    return {
      items: rawItems.map((r) => this.toListItem(r)),
      totalCount: data?.totalCount ?? data?.total ?? rawItems.length,
      pageNumber: data?.pageNumber ?? query.pageNumber ?? 1,
      pageSize: requestedPageSize,
    };
  }

  /** GET /JournalEntries/{id} — full detail including lines. */
  static async getById(id: string): Promise<JournalEntryDetail> {
    const response = await api.get<any>(API_ENDPOINTS.JOURNAL_ENTRIES.GET_BY_ID(id));
    const raw = this.unwrap<any>(response.data);
    const summary = this.toListItem(raw);
    return {
      ...summary,
      createdBy: raw?.createdBy ?? null,
      createdDate: raw?.createdDate ?? null,
      lines: this.asArray(raw?.lines ?? raw?.lines?.$values).map((l) => this.toLine(l)),
    };
  }

  // ==================== Writes ====================

  /** Normalise the create/update request body. */
  private static toBody(data: JournalEntryInput) {
    return {
      date: data.date,
      description: data.description,
      customerId: data.customerId ?? null,
      agentId: data.agentId ?? null,
      workerId: data.workerId ?? null,
      employeeId: data.employeeId ?? null,
      restrictionTypeId: data.restrictionTypeId ?? null,
      lines: (data.lines ?? []).map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description ?? null,
      })),
    };
  }

  /**
   * POST /JournalEntries — create a Draft entry.
   *
   * The live API returns the generated entry NUMBER (e.g. "JE-2026-0004") in
   * `data`, not the GUID. Posting and getById both need the GUID, so we resolve
   * it via the server-side `EntryNumber` exact-match filter (verified live) and
   * return the GUID to keep callers (Save & Post) working.
   *
   * If `data` already looks like a GUID (backend contract may change), it is
   * returned directly without the extra round-trip.
   */
  static async create(data: JournalEntryInput): Promise<string> {
    const response = await api.post<any>(API_ENDPOINTS.JOURNAL_ENTRIES.CREATE, this.toBody(data));
    const payload = this.unwrap<any>(response.data);
    const value = typeof payload === 'string' ? payload : payload?.id ?? payload?.entryNumber ?? '';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return value; // already a GUID
    }
    return this.resolveIdByEntryNumber(value);
  }

  /** Resolve a journal entry's GUID from its server-generated entry number. */
  private static async resolveIdByEntryNumber(entryNumber: string): Promise<string> {
    if (!entryNumber) return '';
    // Exact-match server filter — robust regardless of list ordering / volume.
    const page = await this.getAll({ pageNumber: 1, pageSize: 5, entryNumber });
    const exact = page.items.find((e) => e.entryNumber === entryNumber);
    return (exact ?? page.items[0])?.id ?? '';
  }

  /** PUT /JournalEntries/{id} — update a Draft entry. */
  static async update(id: string, data: JournalEntryInput): Promise<void> {
    await api.put(API_ENDPOINTS.JOURNAL_ENTRIES.UPDATE(id), this.toBody(data));
  }

  /** DELETE /JournalEntries/{id} — delete a Draft entry. */
  static async delete(id: string): Promise<void> {
    await api.delete(API_ENDPOINTS.JOURNAL_ENTRIES.DELETE(id));
  }

  // ==================== Posting ====================

  /** POST /Posting/{journalId} — commit a Draft entry to the ledger. */
  static async post(journalId: string): Promise<void> {
    await api.post(API_ENDPOINTS.POSTING.POST(journalId));
  }

  /** POST /Posting/{id}/unpost — reverse a posted entry back to Draft. */
  static async unpost(id: string): Promise<void> {
    await api.post(API_ENDPOINTS.POSTING.UNPOST(id));
  }
}
