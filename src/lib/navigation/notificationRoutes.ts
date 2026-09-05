export function notificationReferenceRoute(referenceType?: string | null, referenceId?: string | null): string {
  const type = (referenceType ?? '').toLowerCase();
  const suffix = referenceId ? `?openId=${encodeURIComponent(referenceId)}` : '';

  if (type.includes('leave')) return `/hr/leave${suffix}`;
  if (type.includes('permission')) return `/hr/permission-requests${suffix}`;
  if (type.includes('custody')) return `/hr/custody-requests${suffix}`;
  if (type.includes('resignation')) return `/hr/resignation-requests${suffix}`;
  if (type.includes('vacation')) return `/hr/leave${suffix}`;
  if (type.includes('loan')) return `/hr/leave${suffix}`;
  if (type.includes('entitlements')) return `/hr/payroll${suffix}`;
  if (type.includes('jobmodification')) return `/hr/employees${suffix}`;

  return '/notifications';
}
