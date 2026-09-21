import { useQuery } from '@tanstack/react-query';
import { ArrivalReportService } from '@/services/arrival-report.service';
import type { ArrivalReportQuery } from '@/types/api.types';

export function useArrivalReport(query: ArrivalReportQuery) {
  return useQuery({
    queryKey: ['arrival-report', 'brokerage', query],
    queryFn: () => ArrivalReportService.getBrokerage(query),
    placeholderData: (previous) => previous,
  });
}
