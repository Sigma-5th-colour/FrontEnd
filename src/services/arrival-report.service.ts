import { API_ENDPOINTS } from '@/config/api.config';
import { api } from '@/lib/api/client';
import type { ArrivalReportItem, ArrivalReportPage, ArrivalReportQuery } from '@/types/api.types';

export class ArrivalReportService {
  private static isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private static normalizeItem(item: Record<string, unknown>): ArrivalReportItem {
    return Object.entries(item).reduce<Record<string, unknown>>(
      (result, [key, value]) => {
        result[key] = value;
        result[key.charAt(0).toLowerCase() + key.slice(1)] = value;
        return result;
      },
      {}
    ) as unknown as ArrivalReportItem;
  }

  static async getBrokerage(query: ArrivalReportQuery = {}): Promise<ArrivalReportPage> {
    const params: Record<string, string | number | boolean> = {
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 10,
    };
    (Object.keys(query) as Array<keyof ArrivalReportQuery>).forEach((key) => {
      const value = query[key];
      if (value != null && value !== '') params[key] = value;
    });

    const response = await api.get<any>(API_ENDPOINTS.ARRIVAL_REPORT.BROKERAGE, { params });
    const payload = response.data?.data?.value ?? response.data?.data ?? response.data?.value ?? response.data;
    const rawItems = payload?.items?.$values ?? payload?.items ?? payload?.$values ?? [];
    return {
      items: Array.isArray(rawItems) ? rawItems.filter(this.isRecord).map(this.normalizeItem) : [],
      totalCount: payload?.totalCount ?? payload?.total ?? 0,
      pageNumber: payload?.pageNumber ?? query.pageNumber ?? 1,
      pageSize: payload?.pageSize ?? query.pageSize ?? 10,
    };
  }
}
