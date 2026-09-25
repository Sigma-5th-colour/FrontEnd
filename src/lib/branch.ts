/** Sent as `X-Branch-Id` to mean no branch filter (GET only; writes are rejected). */
export const ALL_BRANCHES_ID = 'all';

export function isAllBranches(branchId: string | null | undefined): boolean {
  return !!branchId && branchId.toLowerCase() === ALL_BRANCHES_ID;
}
