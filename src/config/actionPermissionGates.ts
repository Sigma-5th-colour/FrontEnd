import {
  APP_PERMISSIONS,
  hasAccessPermission,
  type PermissionSubject,
} from './appPermissions.ts';
import {
  ACCOUNTING_MANAGE_PERMISSIONS,
  HR_MANAGE_PERMISSIONS,
} from './pagePermissionRequirements.ts';

const HR_SELF_SERVICE_ROLE_NAMES = new Set(
  [
    'Employee',
    'CustomerServiceEmployee',
    'CustomerServiceCallCenter',
    'SalesEmployee',
    'CustomerServiceSales',
    'FollowUpEmployee',
    'AccountingEmployee',
    'HREmployee',
  ].map((role) => role.toLowerCase())
);

function hasHrSelfServiceRole(userAccess: PermissionSubject): boolean {
  if (!userAccess || Array.isArray(userAccess)) return false;
  const claims = userAccess as { roles?: readonly string[] | null };
  return (claims.roles ?? []).some((role) => HR_SELF_SERVICE_ROLE_NAMES.has(role.toLowerCase()));
}

export const CONTRACT_ACTION_PERMISSIONS = {
  create: [APP_PERMISSIONS.CONTRACTS_CREATE],
  update: [APP_PERMISSIONS.CONTRACTS_UPDATE],
  delete: [APP_PERMISSIONS.CONTRACTS_DELETE],
  approve: [APP_PERMISSIONS.CONTRACTS_APPROVE],
} as const;

export function getContractActionGates(userAccess: PermissionSubject) {
  return {
    canCreate: hasAccessPermission(userAccess, CONTRACT_ACTION_PERMISSIONS.create),
    canUpdate: hasAccessPermission(userAccess, CONTRACT_ACTION_PERMISSIONS.update),
    canDelete: hasAccessPermission(userAccess, CONTRACT_ACTION_PERMISSIONS.delete),
    canApprove: hasAccessPermission(userAccess, CONTRACT_ACTION_PERMISSIONS.approve),
    canSign: hasAccessPermission(userAccess, CONTRACT_ACTION_PERMISSIONS.approve),
    canCancel: hasAccessPermission(userAccess, CONTRACT_ACTION_PERMISSIONS.delete),
  };
}

export function getAccountingActionGates(userAccess: PermissionSubject) {
  const canManage = hasAccessPermission(userAccess, ACCOUNTING_MANAGE_PERMISSIONS);
  return {
    canCreate: canManage,
    canUpdate: canManage,
    canDelete: canManage,
    canPost: canManage,
    canUnpost: canManage,
    canClose: canManage,
    canOpen: canManage,
    canManage,
  };
}

export function getHrActionGates(userAccess: PermissionSubject) {
  const canManage = hasAccessPermission(userAccess, HR_MANAGE_PERMISSIONS);
  const canApproveUnitManager =
    canManage || hasAccessPermission(userAccess, APP_PERMISSIONS.HR_APPROVE_UNIT_MANAGER);
  const canApproveHrManager =
    canManage || hasAccessPermission(userAccess, APP_PERMISSIONS.HR_APPROVE_HR_MANAGER);
  const canApproveExecutiveManager =
    canManage || hasAccessPermission(userAccess, APP_PERMISSIONS.HR_APPROVE_EXECUTIVE_MANAGER);
  const canSubmitRequest = canManage || hasHrSelfServiceRole(userAccess);
  return {
    canCreate: canManage,
    canSubmitRequest,
    canUpdate: canManage,
    canDelete: canManage,
    canApprove: canApproveUnitManager || canApproveHrManager || canApproveExecutiveManager,
    canReject: canApproveUnitManager || canApproveHrManager || canApproveExecutiveManager,
    canApproveUnitManager,
    canApproveHrManager,
    canApproveExecutiveManager,
    canManageShifts: canManage || hasAccessPermission(userAccess, APP_PERMISSIONS.HR_SHIFT_MANAGE),
    canExportReports: canManage || hasAccessPermission(userAccess, APP_PERMISSIONS.HR_REPORT_EXPORT),
    canClose: canManage,
    canResetPassword: canManage,
    canManage,
  };
}
