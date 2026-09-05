import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import {
  HREmployeeService,
  HRAttendanceService,
  HRLeaveService,
  HRLeaveTypeService,
  HRPayrollService,
  HRShiftService,
  HRReportService,
  HRPermissionRequestService,
  HRResignationRequestService,
  HRCustodyRequestService,
} from '@/services/hr.service';

import type {
  CreateEmployeeDto,
  EmployeeListQuery,
  UpdateEmployeeDto,
  AttendanceFilterDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  GeneratePayrollDto,
  CreatePermissionRequestDto,
  CreateResignationRequestDto,
  CreateCustodyRequestDto,
  CreateCustodyTypeDto,
  CreateShiftDto,
  UpdateShiftDto,
  AssignEmployeeShiftDto,
  HRReportExportRequestDto,
} from '@/types/hr.types';
import { getCurrentPosition, GeolocationError, geolocationErrorMessage } from '@/utils/geolocation';
import { extractApiError } from '@/lib/api/unwrap';

/**
 * Build a user-facing message for a check-in/out failure. Location-permission
 * problems get a geolocation-specific message; otherwise surface the backend's
 * own error string (e.g. the geofence "Distance: 320m, allowed: 150m" message).
 */
function attendanceErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof GeolocationError) return geolocationErrorMessage(err);
  return extractApiError(err, fallback);
}

// ─── Query keys ──────────────────────────────────────────────────────────────

const QK = {
  employees: (params?: EmployeeListQuery) => ['hr-employees', params] as const,
  employee: (id: string) => ['hr-employee', id] as const,
  shifts: (activeOnly?: boolean) => ['hr-shifts', activeOnly] as const,
  employeeShift: (employeeId?: string) => ['hr-employee-shift', employeeId] as const,
  attendance: (filter: AttendanceFilterDto) => ['hr-attendance', filter] as const,
  leave: ['hr-leave'] as const,
  leaveBalance: (leaveTypeId: string) => ['hr-leave-balance', leaveTypeId] as const,
  employeeBalances: (employeeId?: string, leaveTypeId?: string, year?: number, month?: number) =>
    ['hr-employee-balances', employeeId, leaveTypeId, year, month] as const,
  leaveTypes: ['hr-leave-types'] as const,
  payroll: (month: number, year: number) => ['hr-payroll', month, year] as const,
  payrollHistory: (year?: number) => ['hr-payroll-history', year] as const,
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Employee hooks ───────────────────────────────────────────────────────────

export function useHREmployees(params?: EmployeeListQuery, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.employees(params),
    queryFn: () => HREmployeeService.getAll(params),
    placeholderData: (previous) => previous,
    enabled,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeDto) => HREmployeeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      message.success('تم إضافة الموظف بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إضافة الموظف'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeDto }) =>
      HREmployeeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      message.success('تم تحديث بيانات الموظف بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تحديث الموظف'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => HREmployeeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      message.success('تم تعطيل الموظف بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تعطيل الموظف'));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => HREmployeeService.resetPassword(id),
    onSuccess: () => {
      message.success('تمت إعادة تعيين كلمة المرور بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إعادة تعيين كلمة المرور'));
    },
  });

  return {
    data: query.data,
    employees: query.data?.items ?? [],
    totalCount: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
    createEmployee: createMutation.mutateAsync,
    updateEmployee: updateMutation.mutateAsync,
    deleteEmployee: deleteMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
  };
}

export function useHRPayrollHistory(year?: number) {
  return useQuery({
    queryKey: QK.payrollHistory(year),
    queryFn: () => HRPayrollService.getHistory(year),
    enabled: !!year,
  });
}

export function useHREmployee(id: string) {
  return useQuery({
    queryKey: QK.employee(id),
    queryFn: () => HREmployeeService.getById(id),
    enabled: !!id,
  });
}

// ─── Shift hooks ─────────────────────────────────────────────────────────────

export function useHRShifts(activeOnly?: boolean, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.shifts(activeOnly),
    queryFn: () => HRShiftService.getAll(activeOnly),
    enabled,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateShiftDto) => HRShiftService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-shifts'] });
      message.success('تم إضافة الوردية بنجاح');
    },
    onError: (err) => message.error(extractApiError(err, 'فشل إضافة الوردية')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateShiftDto }) => HRShiftService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-shifts'] });
      message.success('تم تحديث الوردية بنجاح');
    },
    onError: (err) => message.error(extractApiError(err, 'فشل تحديث الوردية')),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      HRShiftService.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-shifts'] });
      message.success('تم تحديث حالة الوردية');
    },
    onError: (err) => message.error(extractApiError(err, 'فشل تحديث حالة الوردية')),
  });

  const assignMutation = useMutation({
    mutationFn: (data: AssignEmployeeShiftDto) => HRShiftService.assign(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hr-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: QK.employee(vars.employeeId) });
      queryClient.invalidateQueries({ queryKey: QK.employeeShift(vars.employeeId) });
      message.success('تم تعيين الوردية للموظف');
    },
    onError: (err) => message.error(extractApiError(err, 'فشل تعيين الوردية')),
  });

  return {
    shifts: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createShift: createMutation.mutateAsync,
    updateShift: updateMutation.mutateAsync,
    setShiftActive: activeMutation.mutateAsync,
    assignShift: assignMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isSettingActive: activeMutation.isPending,
    isAssigning: assignMutation.isPending,
  };
}

export function useHREmployeeShift(employeeId?: string) {
  return useQuery({
    queryKey: QK.employeeShift(employeeId),
    queryFn: () => HRShiftService.getCurrentEmployeeShift(employeeId!),
    enabled: !!employeeId,
  });
}

// ─── Attendance hooks ─────────────────────────────────────────────────────────

/**
 * Attendance records are fetched with a proper cached `useQuery` (keyed by the
 * filter) rather than a fire-and-forget mutation, so results survive re-renders
 * and are invalidated automatically after a check-in / check-out.
 *
 * Pass `enabled = false` to defer the first fetch until the user searches.
 *
 * NOTE: the backend only honours the `employeeId` filter server-side; `status`
 * and date-range filters are applied client-side by the page.
 */
export function useHRAttendance(filter: AttendanceFilterDto, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.attendance(filter),
    queryFn: () => HRAttendanceService.filter(filter),
    placeholderData: (previous) => previous,
    enabled,
  });

  const checkInMutation = useMutation({
    // Acquire device GPS first, then post coordinates. If location permission is
    // denied / unavailable, the request is never sent (backend would reject it).
    mutationFn: async () => {
      const location = await getCurrentPosition();
      return HRAttendanceService.checkIn(location);
    },
    onSuccess: () => {
      message.success('تم تسجيل الحضور بنجاح');
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
    },
    onError: (err) => message.error(attendanceErrorMessage(err, 'فشل تسجيل الحضور')),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const location = await getCurrentPosition();
      return HRAttendanceService.checkOut(location);
    },
    onSuccess: () => {
      message.success('تم تسجيل الانصراف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
    },
    onError: (err) => message.error(attendanceErrorMessage(err, 'فشل تسجيل الانصراف')),
  });

  return {
    records: query.data ?? [],
    isLoading: query.isFetching,
    refetch: query.refetch,
    checkIn: checkInMutation.mutateAsync,
    checkOut: checkOutMutation.mutateAsync,
    isCheckingIn: checkInMutation.isPending,
    isCheckingOut: checkOutMutation.isPending,
  };
}

// ─── Leave hooks ──────────────────────────────────────────────────────────────

export function useHRLeave() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.leave,
    queryFn: () => HRLeaveService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLeaveRequestDto) => HRLeaveService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leave });
      message.success('تم إنشاء طلب الإجازة بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إنشاء طلب الإجازة'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ requestId }: { requestId: string }) =>
      HRLeaveService.approve(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leave });
      message.success('تمت الموافقة على المرحلة الحالية');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل الموافقة على الإجازة'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      HRLeaveService.reject(requestId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leave });
      message.success('تم رفض الإجازة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل رفض الإجازة'));
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (requestId: string) => HRLeaveService.withdraw(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leave });
      message.success('تم سحب طلب الإجازة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل سحب طلب الإجازة'));
    },
  });

  return {
    leaveRequests: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createLeave: createMutation.mutateAsync,
    approveLeave: approveMutation.mutateAsync,
    rejectLeave: rejectMutation.mutateAsync,
    withdrawLeave: withdrawMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
  };
}

// ─── Employee Leave Balance hook ──────────────────────────────────────────────

export function useEmployeeLeaveBalances(params: {
  employeeId?: string;
  leaveTypeId?: string;
  year?: number;
  month?: number;
}) {
  return useQuery({
    queryKey: QK.employeeBalances(params.employeeId, params.leaveTypeId, params.year, params.month),
    queryFn: () => HRLeaveService.getEmployeeBalances(params),
    enabled: !!params.employeeId,
  });
}

// ─── Leave Type hooks ─────────────────────────────────────────────────────────

export function useHRLeaveTypes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.leaveTypes,
    queryFn: () => HRLeaveTypeService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLeaveTypeDto) => HRLeaveTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leaveTypes });
      message.success('تم إضافة نوع الإجازة بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إضافة نوع الإجازة'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeaveTypeDto }) =>
      HRLeaveTypeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leaveTypes });
      message.success('تم تحديث نوع الإجازة بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تحديث نوع الإجازة'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => HRLeaveTypeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.leaveTypes });
      message.success('تم حذف نوع الإجازة بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل حذف نوع الإجازة'));
    },
  });

  return {
    leaveTypes: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createLeaveType: createMutation.mutateAsync,
    updateLeaveType: updateMutation.mutateAsync,
    deleteLeaveType: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ─── Permission Request hooks ─────────────────────────────────────────────────

export function useHRPermissionRequest() {
  const createMutation = useMutation({
    mutationFn: (data: CreatePermissionRequestDto) => HRPermissionRequestService.create(data),
    onSuccess: () => message.success('تم تقديم طلب الاستئذان بنجاح'),
    onError: (err) => message.error(extractApiError(err, 'فشل تقديم طلب الاستئذان')),
  });

  return {
    createPermissionRequest: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

export function useHRPermissionRequests() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['hr-permission-requests'],
    queryFn: () => HRPermissionRequestService.getAll(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => HRPermissionRequestService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-permission-requests'] });
      message.success('تمت الموافقة على طلب الاستئذان');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل الموافقة على الطلب'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      HRPermissionRequestService.reject(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-permission-requests'] });
      message.success('تم رفض طلب الاستئذان');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل رفض الطلب'));
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => HRPermissionRequestService.withdraw(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-permission-requests'] });
      message.success('تم سحب طلب الاستئذان');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل سحب الطلب'));
    },
  });

  const printMutation = useMutation({
    mutationFn: (id: string) => HRPermissionRequestService.print(id),
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تحميل بيانات الطباعة'));
    },
  });

  return {
    permissionRequests: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    approvePermissionRequest: approveMutation.mutateAsync,
    rejectPermissionRequest: rejectMutation.mutateAsync,
    withdrawPermissionRequest: withdrawMutation.mutateAsync,
    printPermissionRequest: printMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isPrinting: printMutation.isPending,
  };
}

// ─── Resignation Request hooks ────────────────────────────────────────────────

export function useHRResignationRequest() {
  const createMutation = useMutation({
    mutationFn: (data: CreateResignationRequestDto) => HRResignationRequestService.create(data),
    onSuccess: () => message.success('تم تقديم طلب الاستقالة بنجاح'),
    onError: (err) => message.error(extractApiError(err, 'فشل تقديم طلب الاستقالة')),
  });

  return {
    createResignationRequest: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

export function useHRResignationRequests() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['hr-resignation-requests'],
    queryFn: () => HRResignationRequestService.getAll(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => HRResignationRequestService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-resignation-requests'] });
      message.success('تمت الموافقة على طلب الاستقالة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل الموافقة على الطلب'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      HRResignationRequestService.reject(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-resignation-requests'] });
      message.success('تم رفض طلب الاستقالة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل رفض الطلب'));
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => HRResignationRequestService.withdraw(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-resignation-requests'] });
      message.success('تم سحب طلب الاستقالة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل سحب الطلب'));
    },
  });

  const printMutation = useMutation({
    mutationFn: (id: string) => HRResignationRequestService.print(id),
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تحميل بيانات الطباعة'));
    },
  });

  return {
    resignationRequests: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    approveResignationRequest: approveMutation.mutateAsync,
    rejectResignationRequest: rejectMutation.mutateAsync,
    withdrawResignationRequest: withdrawMutation.mutateAsync,
    printResignationRequest: printMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isPrinting: printMutation.isPending,
  };
}

// ─── Custody Request hooks ────────────────────────────────────────────────────

export function useHRCustodyTypes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['hr-custody-types'],
    queryFn: () => HRCustodyRequestService.getTypes(),
  });

  const createTypeMutation = useMutation({
    mutationFn: (data: CreateCustodyTypeDto) => HRCustodyRequestService.createType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-custody-types'] });
      message.success('تم إضافة نوع العهدة بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إضافة نوع العهدة'));
    },
  });

  return {
    custodyTypes: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createCustodyType: createTypeMutation.mutateAsync,
    isCreatingType: createTypeMutation.isPending,
  };
}

export function useHRCustodyRequest() {
  const createMutation = useMutation({
    mutationFn: (data: CreateCustodyRequestDto) => HRCustodyRequestService.create(data),
    onSuccess: () => message.success('تم تقديم طلب العهدة بنجاح'),
    onError: (err) => message.error(extractApiError(err, 'فشل تقديم طلب العهدة')),
  });

  return {
    createCustodyRequest: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

export function useHRCustodyRequests() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['hr-custody-requests'],
    queryFn: () => HRCustodyRequestService.getAll(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => HRCustodyRequestService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-custody-requests'] });
      message.success('تمت الموافقة على طلب العهدة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل الموافقة على الطلب'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      HRCustodyRequestService.reject(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-custody-requests'] });
      message.success('تم رفض طلب العهدة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل رفض الطلب'));
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => HRCustodyRequestService.withdraw(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-custody-requests'] });
      message.success('تم سحب طلب العهدة');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل سحب الطلب'));
    },
  });

  const printMutation = useMutation({
    mutationFn: (id: string) => HRCustodyRequestService.print(id),
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تحميل بيانات الطباعة'));
    },
  });

  return {
    custodyRequests: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    approveCustodyRequest: approveMutation.mutateAsync,
    rejectCustodyRequest: rejectMutation.mutateAsync,
    withdrawCustodyRequest: withdrawMutation.mutateAsync,
    printCustodyRequest: printMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isPrinting: printMutation.isPending,
  };
}

// ─── HR Report hooks ─────────────────────────────────────────────────────────

export function useHRReportExport() {
  return useMutation({
    mutationFn: (dto: HRReportExportRequestDto) => HRReportService.exportExcel(dto),
    onSuccess: (blob, vars) => {
      downloadBlob(blob, `HR-${vars.reportType}-${Date.now()}.xlsx`);
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تصدير تقرير الموارد البشرية'));
    },
  });
}

// ─── Payroll hooks ────────────────────────────────────────────────────────────

export function useHRPayroll(month: number, year: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QK.payroll(month, year),
    queryFn: () => HRPayrollService.get(month, year),
    enabled: !!month && !!year,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: (dto: GeneratePayrollDto) => HRPayrollService.generate(dto),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: QK.payroll(vars.month, vars.year) });
      queryClient.invalidateQueries({ queryKey: QK.payrollHistory(vars.year) });
      message.success('تم إنشاء كشف الرواتب بنجاح');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إنشاء كشف الرواتب'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => HRPayrollService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.payroll(month, year) });
      queryClient.invalidateQueries({ queryKey: QK.payrollHistory(year) });
      message.success('تم اعتماد كشف الرواتب');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل اعتماد كشف الرواتب'));
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => HRPayrollService.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.payroll(month, year) });
      queryClient.invalidateQueries({ queryKey: QK.payrollHistory(year) });
      message.success('تم إغلاق كشف الرواتب');
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل إغلاق كشف الرواتب'));
    },
  });

  const exportMutation = useMutation({
    mutationFn: ({ m, y }: { m: number; y: number }) => HRPayrollService.exportExcel(m, y),
    onSuccess: (blob, vars) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll-${vars.m}-${vars.y}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      message.error(extractApiError(err, 'فشل تصدير كشف الرواتب'));
    },
  });

  return {
    payroll: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    generatePayroll: generateMutation.mutateAsync,
    approvePayroll: approveMutation.mutateAsync,
    closePayroll: closeMutation.mutateAsync,
    exportPayroll: exportMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    isApproving: approveMutation.isPending,
    isClosing: closeMutation.isPending,
    isExporting: exportMutation.isPending,
  };
}
