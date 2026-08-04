/**
 * Shared Order Priority, Sorting & Aging Utilities
 * Used by Kitchen, Waiter, and Admin pages.
 * Pure utility functions — no React dependencies.
 */

// ─── Status Sort Weights ────────────────────────────────────────────────────
const KDS_STATUS_WEIGHT: Record<string, number> = {
  PENDING: 0,
  RECEIVED: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY: 3,
  OUT_FOR_DELIVERY: 4,
  SERVED: 5,
  DELIVERED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
  REFUNDED: 7,
};

const WAITER_STATUS_WEIGHT: Record<string, number> = {
  READY: 0,
  OUT_FOR_DELIVERY: 1,
  SERVED: 2,
  DELIVERED: 2,
  COMPLETED: 3,
  CANCELLED: 4,
};

const ADMIN_STATUS_WEIGHT: Record<string, number> = {
  PENDING: 0,
  RECEIVED: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY: 3,
  OUT_FOR_DELIVERY: 4,
  SERVED: 5,
  DELIVERED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
  REFUNDED: 7,
};

// Helper: Get latest activity timestamp (updatedAt || createdAt)
function getLatestTimestamp<T extends { createdAt: string; updatedAt?: string }>(order: T): number {
  const updated = order.updatedAt ? new Date(order.updatedAt).getTime() : 0;
  const created = new Date(order.createdAt).getTime();
  return Math.max(updated, created);
}

// ─── Kitchen Order Sorting ───────────────────────────────────────────────────
// Priority: Urgent Pending (pending >= 30s) → Normal Pending → Accepted → Preparing → Ready → Delivered → Completed
// Inside each group: sorted by latest activity (updatedAt || createdAt) descending
export function sortKDSOrders<T extends { status: string; createdAt: string; updatedAt?: string }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const nowMs = Date.now();
    const ageA = nowMs - new Date(a.createdAt).getTime();
    const ageB = nowMs - new Date(b.createdAt).getTime();

    const isPendingA = a.status === "PENDING" || a.status === "RECEIVED";
    const isPendingB = b.status === "PENDING" || b.status === "RECEIVED";

    // Urgent pending (>= 30s) always first
    const urgentA = isPendingA && ageA >= 30_000;
    const urgentB = isPendingB && ageB >= 30_000;

    if (urgentA && !urgentB) return -1;
    if (!urgentA && urgentB) return 1;

    const weightA = KDS_STATUS_WEIGHT[a.status] ?? 99;
    const weightB = KDS_STATUS_WEIGHT[b.status] ?? 99;
    if (weightA !== weightB) return weightA - weightB;

    // Most recent activity first within same status group
    return getLatestTimestamp(b) - getLatestTimestamp(a);
  });
}

// ─── Waiter Ready Order Sorting ─────────────────────────────────────────────
// Ready → Picked Up → Delivered → Completed; most recent activity first inside each group
export function sortWaiterOrders<T extends { status: string; createdAt: string; updatedAt?: string }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const weightA = WAITER_STATUS_WEIGHT[a.status] ?? 99;
    const weightB = WAITER_STATUS_WEIGHT[b.status] ?? 99;
    if (weightA !== weightB) return weightA - weightB;
    return getLatestTimestamp(b) - getLatestTimestamp(a);
  });
}

// ─── Admin Order Sorting ─────────────────────────────────────────────────────
export function sortAdminOrders<T extends { status: string; createdAt: string; updatedAt?: string }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const weightA = ADMIN_STATUS_WEIGHT[a.status] ?? 99;
    const weightB = ADMIN_STATUS_WEIGHT[b.status] ?? 99;
    if (weightA !== weightB) return weightA - weightB;
    return getLatestTimestamp(b) - getLatestTimestamp(a);
  });
}

// ─── Order Aging Level ───────────────────────────────────────────────────────
export type AgingLevel = 0 | 1 | 2 | 3 | 4;

export interface AgingInfo {
  level: AgingLevel;           // 0=normal, 1=30s+, 2=60s+, 3=2m+, 4=5m+
  ageMs: number;
  ageSeconds: number;
  ageString: string;           // "2m 15s"
  label: string;               // badge text
  labelEmoji: string;          // emoji prefix for badge
  isActive: boolean;           // should any highlight be shown
}

/**
 * Get the aging alert level for a pending order.
 * Returns level 0 (no highlight) for non-pending orders.
 */
export function getOrderAgingInfo(
  status: string,
  createdAt: string,
  nowMs: number = Date.now()
): AgingInfo {
  const isPending = status === "PENDING" || status === "RECEIVED";

  const ageMs = nowMs - new Date(createdAt).getTime();
  const ageSeconds = Math.floor(ageMs / 1000);
  const ageMins = Math.floor(ageSeconds / 60);
  const ageSecs = ageSeconds % 60;
  const ageString = ageMins > 0 ? `${ageMins}m ${ageSecs}s` : `${ageSecs}s`;

  if (!isPending) {
    return { level: 0, ageMs, ageSeconds, ageString, label: "", labelEmoji: "", isActive: false };
  }

  if (ageMs >= 5 * 60_000) {
    return { level: 4, ageMs, ageSeconds, ageString, label: "CRITICAL", labelEmoji: "🔥", isActive: true };
  }
  if (ageMs >= 2 * 60_000) {
    return { level: 3, ageMs, ageSeconds, ageString, label: "DELAYED", labelEmoji: "🚨", isActive: true };
  }
  if (ageMs >= 60_000) {
    return { level: 2, ageMs, ageSeconds, ageString, label: "Priority Order", labelEmoji: "⚠", isActive: true };
  }
  if (ageMs >= 30_000) {
    return { level: 1, ageMs, ageSeconds, ageString, label: `Waiting ${ageString}`, labelEmoji: "⏱", isActive: true };
  }

  return { level: 0, ageMs, ageSeconds, ageString, label: "", labelEmoji: "", isActive: false };
}

// ─── Aging CSS Classes ───────────────────────────────────────────────────────
export function getAgingBorderClass(level: AgingLevel): string {
  switch (level) {
    case 1: return "border-amber-500/70";
    case 2: return "border-amber-400 border-2";
    case 3: return "border-red-500 border-2";
    case 4: return "border-red-700 border-2";
    default: return "";
  }
}

export function getAgingGlowClass(level: AgingLevel): string {
  switch (level) {
    case 1: return "shadow-[0_0_12px_rgba(245,158,11,0.15)]";
    case 2: return "shadow-[0_0_18px_rgba(245,158,11,0.3)]";
    case 3: return "shadow-[0_0_20px_rgba(239,68,68,0.35)]";
    case 4: return "shadow-[0_0_28px_rgba(185,28,28,0.5)]";
    default: return "";
  }
}

export function getAgingBadgeClass(level: AgingLevel): string {
  switch (level) {
    case 1: return "bg-amber-500/15 text-amber-400 border-amber-500/40";
    case 2: return "bg-amber-600/20 text-amber-300 border-amber-500/60";
    case 3: return "bg-red-600/20 text-red-300 border-red-500/60";
    case 4: return "bg-red-900/40 text-red-200 border-red-600/80";
    default: return "";
  }
}
