/**
 * Shared Order Priority, Sorting & Aging Utilities
 * Used by Kitchen, Waiter, and Admin pages.
 * Pure utility functions — no React dependencies.
 */

// ─── Status Sort Weights ────────────────────────────────────────────────────
const STATUS_PRIORITY: Record<string, number> = {
  PENDING: 1,
  RECEIVED: 1,
  ACCEPTED: 2,
  PREPARING: 3,
  COOKING: 3,
  READY: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
  SERVED: 6,
  COMPLETED: 7,
  CANCELLED: 8,
  REFUNDED: 8,
};

export type SortableOrder = {
  id: string;
  orderNumber?: string;
  status: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  [key: string]: any;
};

/**
 * Deterministically sorts an array of orders based on:
 * 1. Status Priority (e.g. PENDING > ACCEPTED > PREPARING)
 * 2. Newest Age First within the exact same status (so new orders pop at the TOP of their group)
 * 3. Order ID as a stable fallback
 */
export function sortOrders<T extends SortableOrder>(orders: T[]): T[] {
  // Create a shallow copy so we don't mutate the original array if it's frozen by React
  return [...orders].sort((a, b) => {
    // 1. Sort by Status Priority
    const weightA = STATUS_PRIORITY[a.status?.toUpperCase()] ?? 99;
    const weightB = STATUS_PRIORITY[b.status?.toUpperCase()] ?? 99;

    if (weightA !== weightB) {
      return weightA - weightB; // Lower number comes first
    }

    // 2. Sort by Age (Newest First = Descending createdAt)
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();

    if (timeA !== timeB) {
      return timeB - timeA; // Higher time (newer) comes first
    }

    // 3. Fallback to Order Number or ID for absolute deterministic sorting
    if (a.orderNumber && b.orderNumber) {
      return b.orderNumber.localeCompare(a.orderNumber);
    }
    
    return b.id.localeCompare(a.id);
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
