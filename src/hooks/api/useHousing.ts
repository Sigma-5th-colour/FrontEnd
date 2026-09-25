import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { HousingService } from '@/services/housing.service';
import { extractApiError } from '@/lib/api/unwrap';
import type { HousingDto } from '@/types/housing.types';

const HOUSING_KEY = 'housing';
const HOUSING_ACTIVE_KEY = 'housing-active';

export function useHousings(params?: {
  name?: string;
  nameMatch?: number;
  address?: string;
  addressMatch?: number;
  notes?: string;
  notesMatch?: number;
  isActive?: boolean;
  hasAvailableSlots?: boolean;
  capacityMin?: number;
  capacityMax?: number;
  workerHousingCostMin?: number;
  workerHousingCostMax?: number;
  housingOperationPriceMin?: number;
  housingOperationPriceMax?: number;
}) {
  const queryClient = useQueryClient();

  const { data: housings, isLoading, error, refetch } = useQuery({
    queryKey: [HOUSING_KEY, params],
    queryFn: () => HousingService.getAll(params),
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: (data: HousingDto) => HousingService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HOUSING_KEY] });
      queryClient.invalidateQueries({ queryKey: [HOUSING_ACTIVE_KEY] });
      message.success('تمت إضافة السكن بنجاح / Housing unit created');
    },
    onError: (err: unknown) => {
      message.error(extractApiError(err, 'فشل إضافة السكن / Failed to create housing'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HousingDto }) =>
      HousingService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HOUSING_KEY] });
      queryClient.invalidateQueries({ queryKey: [HOUSING_ACTIVE_KEY] });
      message.success('تم تحديث السكن بنجاح / Housing unit updated');
    },
    onError: (err: unknown) => {
      message.error(extractApiError(err, 'فشل تحديث السكن / Failed to update housing'));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => HousingService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HOUSING_KEY] });
      queryClient.invalidateQueries({ queryKey: [HOUSING_ACTIVE_KEY] });
      message.success('تم تغيير حالة السكن / Housing status toggled');
    },
    onError: (err: unknown) => {
      message.error(extractApiError(err, 'فشل تغيير الحالة / Failed to toggle status'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => HousingService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HOUSING_KEY] });
      queryClient.invalidateQueries({ queryKey: [HOUSING_ACTIVE_KEY] });
      message.success('تم حذف السكن / Housing unit deleted');
    },
    onError: (err: unknown) => {
      message.error(extractApiError(err, 'فشل حذف السكن / Failed to delete housing'));
    },
  });

  return {
    housings,
    isLoading,
    error,
    refetch,
    createHousing: createMutation.mutateAsync,
    updateHousing: updateMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    deleteHousing: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isToggling: toggleActiveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useHousingActiveList() {
  return useQuery({
    queryKey: [HOUSING_ACTIVE_KEY],
    queryFn: () => HousingService.getActiveList(),
  });
}

export function useHousing(id?: string) {
  return useQuery({
    queryKey: [HOUSING_KEY, id],
    queryFn: () => HousingService.getById(id!),
    enabled: !!id,
  });
}
