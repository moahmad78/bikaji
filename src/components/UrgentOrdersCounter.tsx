"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Clock, Flame, RotateCcw } from "lucide-react";

export type AgingFilterType = "ALL" | "URGENT_ALL" | "WAITING_30S" | "CRITICAL_2M";

interface UrgentOrdersCounterProps {
  orders: Array<{
    id: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
  }>;
  activeFilter: AgingFilterType;
  onFilterChange: (filter: AgingFilterType) => void;
}

export function UrgentOrdersCounter({
  orders,
  activeFilter,
  onFilterChange,
}: UrgentOrdersCounterProps) {
  // Self-contained time ticker to recalculate aging counts every 3 seconds
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const nowMs = Date.now();

  let urgentAllCount = 0;
  let waiting30sCount = 0;
  let critical2mCount = 0;

  for (const order of orders) {
    const isPending = order.status === "PENDING" || order.status === "RECEIVED";
    if (!isPending) continue;

    const ageMs = nowMs - new Date(order.createdAt).getTime();

    if (ageMs >= 30_000) {
      urgentAllCount++;
    }

    if (ageMs >= 30_000 && ageMs < 120_000) {
      waiting30sCount++;
    } else if (ageMs >= 120_000) {
      critical2mCount++;
    }
  }

  const toggleFilter = (filter: AgingFilterType) => {
    if (activeFilter === filter) {
      onFilterChange("ALL");
    } else {
      onFilterChange(filter);
    }
  };

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#14080a] border border-[#2d191b] shadow-inner">
      {/* Total Urgent Button */}
      <button
        type="button"
        onClick={() => toggleFilter("URGENT_ALL")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
          activeFilter === "URGENT_ALL"
            ? "bg-red-600 text-white border-red-400 ring-2 ring-red-500/50 shadow-md"
            : "bg-[#201012] text-red-300 border-red-900/40 hover:bg-[#2c1518] hover:border-red-700/60"
        }`}
        title="Filter all urgent pending orders"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="hidden sm:inline">Urgent:</span>
        <span className="font-extrabold font-mono text-sm">{urgentAllCount}</span>
      </button>

      {/* Waiting >30s Button */}
      <button
        type="button"
        onClick={() => toggleFilter("WAITING_30S")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
          activeFilter === "WAITING_30S"
            ? "bg-amber-600 text-white border-amber-400 ring-2 ring-amber-500/50 shadow-md"
            : "bg-[#1f160a] text-amber-300 border-amber-900/40 hover:bg-[#2a1d0d] hover:border-amber-700/60"
        }`}
        title="Filter pending orders waiting > 30 seconds"
      >
        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="hidden sm:inline">Waiting &gt;30s:</span>
        <span className="font-extrabold font-mono text-sm">{waiting30sCount}</span>
      </button>

      {/* Critical >2m Button */}
      <button
        type="button"
        onClick={() => toggleFilter("CRITICAL_2M")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
          activeFilter === "CRITICAL_2M"
            ? "bg-red-700 text-white border-red-400 ring-2 ring-red-600/50 shadow-md animate-pulse"
            : "bg-[#240a0e] text-red-400 border-red-950 hover:bg-[#320e13] hover:border-red-800"
        }`}
        title="Filter critical pending orders waiting > 2 minutes"
      >
        <Flame className="w-3.5 h-3.5 text-red-500 shrink-0 animate-bounce" />
        <span className="hidden sm:inline">Critical &gt;2m:</span>
        <span className="font-extrabold font-mono text-sm">{critical2mCount}</span>
      </button>

      {/* Clear Filter button if active */}
      {activeFilter !== "ALL" && (
        <button
          type="button"
          onClick={() => onFilterChange("ALL")}
          className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700"
          title="Reset urgent filter"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
