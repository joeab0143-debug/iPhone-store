// Tiny pub/sub so any component that mutates cash-affecting data (a sale, a
// purchase, an expense, a due payment) can tell the top-of-app DashboardStats
// bar to refetch immediately, instead of waiting for its poll interval.

export const DASHBOARD_REFRESH_EVENT = "pf:refresh-dashboard";

export function emitDashboardRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
  }
}
