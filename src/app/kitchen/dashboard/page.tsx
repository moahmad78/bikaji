"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  TrendingUp,
  Clock,
  Zap,
  AlertTriangle,
  Flame,
  Award,
  Download,
  ArrowLeft,
  ChevronRight,
  TrendingDown,
  RefreshCw,
  Sparkles,
  ChefHat,
  Coffee,
  CheckCircle,
  FileSpreadsheet,
  Activity
} from "lucide-react";
import { getKDSAnalytics } from "@/actions/kds";

// Interface definitions matching actions/kds.ts
interface FastestOrder {
  id: string;
  orderNumber: string;
  prepTimeMins: number;
  finalAmount: number;
  createdAt: string;
}

interface HourlyDistribution {
  hour: number;
  count: number;
}

interface MostOrderedDish {
  name: string;
  quantity: number;
  isVeg: boolean;
}

interface AnalyticsData {
  averagePrepTimeMins: number;
  fastestPrepTimeMins: number;
  fastestPreparedOrders: FastestOrder[];
  delayedOrdersCount: number;
  chefWorkloadPercentage: number;
  peakOrderHours: HourlyDistribution[];
  mostOrderedDishes: MostOrderedDish[];
  kitchenEfficiencyPercentage: number;
  liveActiveOrderCount: number;
  completedTodayCount: number;
}

export default function KitchenDashboardPage() {
  const router = useRouter();
  
  // State
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const socketRef = useRef<Socket | null>(null);

  // Load metrics function
  const fetchMetrics = async (dateStr?: string) => {
    setRefreshing(true);
    try {
      const res = await getKDSAnalytics(dateStr || selectedDate);
      if (res.success && res.analytics) {
        setData(res.analytics as any);
      }
    } catch (err) {
      console.error("Error loading kitchen analytics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch metrics on mount and when date changes
  useEffect(() => {
    fetchMetrics(selectedDate);
  }, [selectedDate]);

  // Real-time socket updates: whenever order states transition, reload dashboard metrics
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl, { reconnectionAttempts: 3, timeout: 2000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Refresh metrics on order transitions
    const handleSocketUpdate = () => {
      console.log("[Dashboard] Socket update received, refreshing metrics...");
      fetchMetrics(selectedDate);
    };

    socket.on("order-new", handleSocketUpdate);
    socket.on("order-accepted", handleSocketUpdate);
    socket.on("order-preparing", handleSocketUpdate);
    socket.on("order-ready", handleSocketUpdate);
    socket.on("order-completed", handleSocketUpdate);
    socket.on("order-cancelled", handleSocketUpdate);
    socket.on("order-updated", handleSocketUpdate);

    return () => {
      socket.disconnect();
    };
  }, [selectedDate]);

  // Generate and Download CSV Report client-side
  const handleDownloadCSV = () => {
    if (!data) return;

    // Header fields
    const headers = [
      "Average Prep Time (Mins)",
      "Fastest Prep Time (Mins)",
      "Delayed Orders Count",
      "Kitchen Efficiency (%)",
      "Completed Orders Today",
      "Report Date"
    ];

    // Main data row
    const row = [
      data.averagePrepTimeMins,
      data.fastestPrepTimeMins,
      data.delayedOrdersCount,
      data.kitchenEfficiencyPercentage,
      data.completedTodayCount,
      selectedDate
    ];

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    csvContent += row.join(",") + "\n\n";

    // Add list of most ordered dishes to report
    csvContent += "MOST ORDERED DISHES\n";
    csvContent += "Dish Name,Quantity Ordered\n";
    data.mostOrderedDishes.forEach(dish => {
      csvContent += `"${dish.name}",${dish.quantity}\n`;
    });
    csvContent += "\n";

    // Add list of fastest prepared orders to report
    csvContent += "FASTEST PREPARED ORDERS\n";
    csvContent += "Order Number,Prep Time (Mins),Final Amount (INR),Created At\n";
    data.fastestPreparedOrders.forEach(o => {
      csvContent += `${o.orderNumber},${o.prepTimeMins},${o.finalAmount},"${new Date(o.createdAt).toLocaleTimeString()}"\n`;
    });

    // Create anchor link and click it to trigger browser download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bikaji_Kitchen_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert hour number to readable AM/PM format
  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  // Calculate highest count of orders in distribution for SVG scaling
  const maxHourlyCount = data ? Math.max(...data.peakOrderHours.map(h => h.count), 1) : 1;

  return (
    <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col antialiased">
      {/* Dashboard Header */}
      <header className="bg-[#1a0f11] border-b border-[#361f22] sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-large">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/kitchen")}
            className="w-10 h-10 rounded-premium bg-[#251416] border border-[#361f22] text-[#baa47f] hover:text-white hover:border-[#baa47f]/45 flex items-center justify-center transition cursor-pointer"
            title="Return to KDS Ticket Screen"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-lg tracking-tight text-white">PERFORMANCE DASHBOARD</span>
              <span className="text-[9px] bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 px-2 py-0.5 rounded font-extrabold uppercase tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Metrics
              </span>
            </div>
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block mt-0.5">
              Real-Time Kitchen Metrics & Analytical Insights
            </span>
          </div>
        </div>

        {/* Date Selector and Download controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-bold uppercase">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1c0f11] border border-[#361f22] text-zinc-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-gold-500/40"
            />
          </div>

          <button
            onClick={() => fetchMetrics()}
            disabled={refreshing}
            className="p-2.5 rounded-lg bg-[#251416] border border-[#361f22] text-[#baa47f] hover:text-white hover:border-[#baa47f]/45 transition cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
            title="Refresh statistics manually"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={!data || data.completedTodayCount === 0 && data.liveActiveOrderCount === 0}
            className="px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider border border-gold-500/20 hover:bg-[#871b30] transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4 text-gold-300" /> Export CSV Report
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col gap-6">
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3 text-zinc-400">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase font-bold tracking-widest">Aggregating Kitchen Metrics...</span>
          </div>
        ) : !data ? (
          <div className="h-96 flex flex-col justify-center items-center text-center text-zinc-500 border border-dashed border-[#361f22] rounded-2xl p-6">
            <AlertTriangle className="w-12 h-12 text-zinc-650 mb-3" />
            <h3 className="text-lg font-bold text-zinc-400 mb-1">No Data Available</h3>
            <p className="text-xs max-w-xs leading-normal">
              No orders found for the selected date ({selectedDate}). Change date to review historical metrics.
            </p>
          </div>
        ) : (
          <>
            {/* Overview Metric Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Avg prep time */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-5 flex items-center justify-between shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold-600/5 rounded-bl-[100px] pointer-events-none" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Average Prep Time</span>
                  <span className="text-3xl font-display font-extrabold text-white mt-1">
                    {data.averagePrepTimeMins} <span className="text-sm font-sans font-medium text-zinc-400">min</span>
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Target prep &lt; 15 mins
                  </span>
                </div>
                <div className="w-12 h-12 bg-gold-600/10 border border-gold-600/30 rounded-lg flex items-center justify-center text-gold-400 shadow-sm shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              {/* Efficiency SLA */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-5 flex items-center justify-between shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-maroon-900/5 rounded-bl-[100px] pointer-events-none" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">SLA Efficiency</span>
                  <span className="text-3xl font-display font-extrabold text-white mt-1">
                    {data.kitchenEfficiencyPercentage}%
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> SLA limit compliance
                  </span>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm shrink-0 border ${
                  data.kitchenEfficiencyPercentage >= 85
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}>
                  <Zap className="w-6 h-6" />
                </div>
              </div>

              {/* Chef Workload */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-5 flex items-center justify-between shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-bl-[100px] pointer-events-none" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Chef Workload</span>
                  <span className="text-3xl font-display font-extrabold text-white mt-1">
                    {data.chefWorkloadPercentage}%
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase mt-2 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-blue-400" /> Active cooking load
                  </span>
                </div>
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-600/30 rounded-lg flex items-center justify-center text-blue-400 shadow-sm shrink-0">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Delayed tickets */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-5 flex items-center justify-between shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-650/5 rounded-bl-[100px] pointer-events-none" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Delayed Orders</span>
                  <span className="text-3xl font-display font-extrabold text-white mt-1">
                    {data.delayedOrdersCount}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Exceeded SLA countdown
                  </span>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm shrink-0 border ${
                  data.delayedOrdersCount > 0
                    ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500"
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Middle Grid: Charts and Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Peak Order Hours Chart (SVG) */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-6 lg:col-span-2 shadow-soft flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-display font-extrabold text-white uppercase tracking-wider">
                    Peak Order Hours
                  </h3>
                  <span className="text-[10px] text-zinc-500 block mt-1 uppercase tracking-wider">
                    Frequency of orders placed by hour of the day
                  </span>
                </div>

                {/* SVG Chart */}
                <div className="w-full h-64 mt-6 relative">
                  <svg className="w-full h-full" viewBox="0 0 500 220" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="30" y1="20" x2="480" y2="20" stroke="#251416" strokeDasharray="3" />
                    <line x1="30" y1="70" x2="480" y2="70" stroke="#251416" strokeDasharray="3" />
                    <line x1="30" y1="120" x2="480" y2="120" stroke="#251416" strokeDasharray="3" />
                    <line x1="30" y1="170" x2="480" y2="170" stroke="#251416" strokeDasharray="3" />
                    <line x1="30" y1="190" x2="480" y2="190" stroke="#361f22" strokeWidth="2" />

                    {/* Chart Bars */}
                    {data.peakOrderHours.map((h, i) => {
                      const barWidth = 14;
                      const gap = 5;
                      const x = 35 + i * (barWidth + gap);
                      const height = (h.count / maxHourlyCount) * 150;
                      const y = 190 - height;

                      return (
                        <g key={h.hour} className="group/bar">
                          {/* Gradient glow bar */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={height}
                            fill={h.count > 0 ? "url(#barGrad)" : "#1d0f11"}
                            rx="2"
                            className="transition-all duration-300 hover:fill-gold-500"
                          />
                          
                          {/* Invisible hover area */}
                          <rect
                            x={x - 2}
                            y={10}
                            width={barWidth + 4}
                            height={180}
                            fill="transparent"
                            className="cursor-pointer"
                          />

                          {/* Hover Tooltip */}
                          <text
                            x={x + barWidth / 2}
                            y={Math.max(15, y - 8)}
                            textAnchor="middle"
                            fill="#dfd26e"
                            fontSize="8"
                            fontWeight="bold"
                            className="opacity-0 group-hover/bar:opacity-100 transition-opacity"
                          >
                            {h.count} orders
                          </text>
                        </g>
                      );
                    })}

                    {/* Gradients */}
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d84c68" />
                        <stop offset="50%" stopColor="#701a2b" />
                        <stop offset="100%" stopColor="#3b260d" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* X Axis labels (Hourly indicators: 12 PM, 6 PM etc) */}
                  <div className="flex justify-between text-[9px] text-zinc-500 px-7 mt-2 font-bold uppercase tracking-wider">
                    <span>12 AM</span>
                    <span>6 AM</span>
                    <span>12 PM</span>
                    <span>6 PM</span>
                    <span>11 PM</span>
                  </div>
                </div>
              </div>

              {/* Most Ordered Dishes */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-6 shadow-soft flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-display font-extrabold text-white uppercase tracking-wider">
                    Most Ordered Dishes
                  </h3>
                  <span className="text-[10px] text-zinc-500 block mt-1 uppercase tracking-wider">
                    Bestselling recipes and customer favorites today
                  </span>
                </div>

                <div className="flex flex-col gap-4 mt-6 flex-1 justify-center">
                  {data.mostOrderedDishes.length === 0 ? (
                    <div className="text-center text-xs text-zinc-550 italic py-8">
                      No dishes prepared yet.
                    </div>
                  ) : (
                    data.mostOrderedDishes.map((dish, index) => {
                      const maxQty = Math.max(...data.mostOrderedDishes.map(d => d.quantity), 1);
                      const progressPct = Math.round((dish.quantity / maxQty) * 100);

                      return (
                        <div key={dish.name} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[10px] text-gold-500 w-4 font-mono font-extrabold">
                                #{index + 1}
                              </span>
                              <span className="text-zinc-200 truncate">{dish.name}</span>
                            </div>
                            <span className="text-white font-mono font-extrabold">{dish.quantity} orders</span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-[#14080a] border border-[#361f22] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Fastest Orders list and active dashboard totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Fastest prepared orders */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-6 lg:col-span-2 shadow-soft">
                <h3 className="text-sm font-display font-extrabold text-white uppercase tracking-wider">
                  Fastest Prepared Tickets
                </h3>
                <span className="text-[10px] text-zinc-500 block mt-1 uppercase tracking-wider">
                  Speed champion tickets and kitchen team bests today
                </span>

                <div className="mt-6 flex flex-col gap-3">
                  {data.fastestPreparedOrders.length === 0 ? (
                    <div className="text-center text-xs text-zinc-550 italic py-6 border border-dashed border-[#361f22] rounded-lg">
                      Speed logs are empty. Complete an order to log.
                    </div>
                  ) : (
                    data.fastestPreparedOrders.map((o) => (
                      <div
                        key={o.id}
                        className="bg-[#14080a] border border-[#251416] hover:border-gold-500/20 px-4 py-3 rounded-lg flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-display font-extrabold text-xs">
                            🏆
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-white">
                              Ticket {o.orderNumber}
                            </span>
                            <span className="text-[9px] text-zinc-500 block font-bold uppercase mt-0.5">
                              Ordered at: {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold text-emerald-400 block">
                            ⚡ {o.prepTimeMins} mins
                          </span>
                          <span className="text-[10px] text-zinc-400 font-bold block mt-0.5">
                            Amount: ₹{o.finalAmount}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary Live Counts widget */}
              <div className="bg-[#1c0f11] rounded-xl border border-[#361f22] p-6 shadow-soft flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-display font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-gold-500" /> Live Kitchen Operations
                  </h3>
                  <span className="text-[10px] text-zinc-500 block mt-1 uppercase tracking-wider">
                    Current active workflow status
                  </span>
                </div>

                <div className="flex flex-col gap-4 mt-6 flex-1 justify-center">
                  <div className="flex justify-between items-center text-xs py-2 border-b border-[#251416]">
                    <span className="text-zinc-400 font-bold uppercase">Active Pending Queue:</span>
                    <span className="text-sm font-extrabold text-amber-500 font-mono">
                      {data.liveActiveOrderCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2 border-b border-[#251416]">
                    <span className="text-zinc-400 font-bold uppercase">Completed Today:</span>
                    <span className="text-sm font-extrabold text-emerald-500 font-mono">
                      {data.completedTodayCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2">
                    <span className="text-zinc-400 font-bold uppercase">Total Orders Handled:</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {data.completedTodayCount + data.liveActiveOrderCount}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/kitchen")}
                  className="w-full py-2.5 rounded-lg bg-[#251416] border border-[#361f22] text-[#baa47f] hover:text-white hover:border-[#baa47f]/45 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 mt-4"
                >
                  Enter KDS Monitor Console <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
