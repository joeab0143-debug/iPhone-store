// Tiny pub/sub so any component that mutates cash-affecting data (a sale, a
// purchase, an expense, a due payment) can tell the top-of-app DashboardStats
// bar to refetch immediately, instead of waiting for its poll interval.

export const DASHBOARD_REFRESH_EVENT = "pf:refresh-dashboard";

export function emitDashboardRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
  }
}

// Same idea, but for the POS-Manager-approval workflow: fired the instant a
// request is queued (POS Manager side) or approved/rejected (admin side),
// so the Sidebar's pending-count badge and any open Approvals/"My Requests"
// list update immediately in this tab -- no waiting for the next poll tick,
// no page refresh. This only reaches listeners in the SAME browser tab;
// cross-device/cross-tab updates still rely on the short poll interval in
// Sidebar.tsx / ApprovalsTab.tsx.
export const APPROVALS_REFRESH_EVENT = "pf:refresh-approvals";

export function emitApprovalsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APPROVALS_REFRESH_EVENT));
  }
}
