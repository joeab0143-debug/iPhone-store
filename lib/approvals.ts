import type { D1Database } from "@cloudflare/workers-types";

// Central helper for the POS Manager approval workflow.
//
// The rule (set in Settings): a POS Manager can Sell, and can add Expense/
// Loan/Gadget-sale entries, freely -- those are their day-to-day job and
// apply immediately, same as an admin. But editing or deleting any existing
// record, or buying new stock (Buy), does NOT take effect right away for a
// POS Manager -- it's queued here instead, and only applied once the admin
// approves it from the Approvals tab. An admin's own requests always apply
// immediately; this module is only ever consulted for a pos_manager role.

export type ApprovalActionType = "edit" | "delete" | "buy";

// Keep in sync with the switch in applyPendingApproval() below -- every
// resource_type inserted here must have a matching case there, or approving
// it will fail.
export type ApprovalResourceType =
  | "phone"
  | "sale"
  | "loan_account"
  | "expense_category"
  | "expense"
  | "gadget"
  | "outside_deal";

export interface QueueApprovalParams {
  actionType: ApprovalActionType;
  resourceType: ApprovalResourceType;
  resourceId?: number | string | null;
  resourceLabel: string;
  payload?: unknown;
  requestedBy: string;
}

export async function queueApproval(
  db: D1Database,
  params: QueueApprovalParams
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO pending_approvals
        (action_type, resource_type, resource_id, resource_label, payload, requested_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.actionType,
      params.resourceType,
      params.resourceId ?? null,
      params.resourceLabel,
      params.payload !== undefined ? JSON.stringify(params.payload) : null,
      params.requestedBy
    )
    .run();
  return Number(result.meta.last_row_id);
}
