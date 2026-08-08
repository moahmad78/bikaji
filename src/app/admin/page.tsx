"use client";

import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  Sparkles,
  Users,
  Utensils,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Zap,
  Activity,
  Heart,
  UserCheck
} from "lucide-react";
import { getAdminDashboardData } from "@/actions/admin";

export default function AdminDashboardHome() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [liveActivityFeed, setLiveActivityFeed] = useState<any[]>([]);

  // Fetch Dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const res = await getAdminDashboardData();
      if (res.success && res.metrics) {
        setMetrics(res.metrics);
        setLiveActivityFeed(res.metrics.liveActivity || []);
        setError(null);
      } else {
        setError(res.error || "Failed to load dashboard metrics.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Real-time socket sync
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      socket.emit("admin-connected");
    });

    const handleEventTrigger = () => {
      fetchDashboardStats();
    };

    const events = [
      "ORDER_CREATED", "ORDER_ACCEPTED", "ORDER_COOKING", "ORDER_READY",
      "ORDER_PICKED_UP", "ORDER_DELIVERED", "ORDER_COMPLETED", "ORDER_CANCELLED",
      "ORDER_DELAYED", "ORDER_UPDATED", "PAYMENT_COMPLETED", "TABLE_CLOSED",
      "SERVICE_REQUEST", "REQUEST_RESOLVED", "customer-request", "order-new"
    ];

    events.forEach(evt => socket.on(evt, handleEventTrigger));

    return () => {
      events.forEach(evt => socket.off(evt, handleEventTrigger));
      socket.disconnect();
    };
  }, []);

  // Custom vector calculations for Hourly Revenue SVG area chart
  const revenueChartPoints = useMemo(() => {
    if (!metrics?.hourlyOrders) return "";
    const hours = metrics.hourlyOrders;
    
    // Scale parameters
    const width = 500;
    const height = 150;
    const padding = 15;
    
    const maxVal = Math.max(...hours.map((h: any) => h.revenue || (h.count * 150))) || 100;
    
    const points = hours.map((h: any, i: number) => {
      const x = padding + (i / 23) * (width - padding * 2);
      const val = h.revenue || (h.count * 150);
      const y = height - padding - (val / maxVal) * (height - padding * 2);
      return { x, y };
    });

    const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(" ");
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    
    return { pathD, areaD, points };
  }, [metrics]);

  // Donut chart vector math
  const paymentDonutPaths = useMemo(() => {
    if (!metrics?.paymentMethods) return [];
    const methods = metrics.paymentMethods;
    const total = Object.values(methods).reduce((sum: number, val: any) => sum + val, 0) || 1;
    
    let currentAngle = 0;
    const radius = 50;
    const cx = 60;
    const cy = 60;
    
    const colors = [
      { name: "UPI", color: "#baa47f", value: methods.UPI },
      { name: "CASH", color: "#3b82f6", value: methods.CASH },
      { name: "CARD", color: "#10b981", value: methods.CARD },
      { name: "PAY ON EXIT", color: "#f59e0b", value: methods.PAY_ON_EXIT || 0 },
      { name: "SPLIT", color: "#a855f7", value: methods.SPLIT_BILL },
    ];

    return colors.map(method => {
      const percentage = method.value / total;
      const angle = percentage * 360;
      
      // Arc coordinates
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const x1 = cx + radius * Math.cos((startAngle - 90) * Math.PI / 180);
      const y1 = cy + radius * Math.sin((startAngle - 90) * Math.PI / 180);
      const x2 = cx + radius * Math.cos((endAngle - 90) * Math.PI / 180);
      const y2 = cy + radius * Math.sin((endAngle - 90) * Math.PI / 180);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      const pathD = angle === 360 
        ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius}`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
      
      currentAngle += angle;
      
      return {
        ...method,
        percentage: Math.round(percentage * 100),
        pathD
      };
    }).filter(m => m.value > 0);
  }, [metrics]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading operations console...</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-lg font-bold">Metrics Loading Failure</h2>
        <p className="text-xs text-zinc-400 max-w-xs mt-1 leading-relaxed">{error}</p>
        <button
          onClick={fetchDashboardStats}
          className="mt-6 px-4 py-2 bg-primary hover:bg-[#871b30] border border-[#baa47f]/20 text-white rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer"
        >
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            RESTAURANT TELEMETRY
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Realtime Analytics & Performance Indicators
          </p>
        </div>

        <span className="text-[10px] text-[#baa47f] font-mono font-bold bg-maroon-950/20 border border-[#baa47f]/25 px-3 py-1 rounded-full uppercase tracking-wider hidden sm:inline-block">
          Zone: MAIN BRANCH
        </span>
      </div>

      {/* KPI STATS CARD GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start text-zinc-550">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today's Revenue</span>
            <DollarSign className="w-4 h-4 text-gold-550" />
          </div>
          <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
            ₹{metrics.todayRevenue.toFixed(0)}
          </h2>
          <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs yesterday
          </span>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start text-zinc-550">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today's Tickets</span>
            <ShoppingBag className="w-4 h-4 text-[#baa47f]" />
          </div>
          <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
            {metrics.todayOrdersCount}
          </h2>
          <span className="text-[9px] text-zinc-400 font-medium">
            {metrics.completedOrdersCount} completed • {metrics.cancelledOrdersCount} void
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start text-zinc-550">
            <span className="text-[10px] font-bold uppercase tracking-wider">AOV & Efficiency</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
            ₹{metrics.averageOrderValue.toFixed(0)}
          </h2>
          <span className="text-[9px] text-zinc-400 font-medium">
            Avg Cook Time: 12.4 mins
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start text-zinc-550">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Tables</span>
            <Utensils className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
            {metrics.occupiedTablesCount}
          </h2>
          <span className="text-[9px] text-zinc-400 font-medium flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-gold-550" /> {metrics.availableTablesCount} open tables free
          </span>
        </div>
      </div>

      {/* DETAILED CHARTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Revenue Trend SVG Chart */}
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 shadow-soft md:col-span-2 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#201011] pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-gold-550" /> Hourly Load & Revenue Distribution
            </h3>
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">
              Today (00:00 - 24:00)
            </span>
          </div>

          <div className="relative h-44 w-full mt-2">
            {revenueChartPoints ? (
              <svg viewBox="0 0 500 150" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#871b30" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#871b30" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Area path */}
                <path d={revenueChartPoints.areaD} fill="url(#chartGlow)" />
                {/* Stroke path */}
                <path d={revenueChartPoints.pathD} fill="none" stroke="#baa47f" strokeWidth="2.5" />
                {/* Grid lines */}
                <line x1="15" y1="135" x2="485" y2="135" stroke="#251416" strokeWidth="1" />
                {/* Interactive Points */}
                {revenueChartPoints.points.map((p: any, idx: number) => (
                  idx % 4 === 0 && (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="3" fill="#baa47f" />
                      <text x={p.x} y="148" fill="#555" fontSize="7" textAnchor="middle">
                        {idx}:00
                      </text>
                    </g>
                  )
                ))}
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-650">
                Insufficient hourly transaction data
              </div>
            )}
          </div>
        </div>

        {/* Payments Split SVG Donut */}
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 shadow-soft flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#201011] pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" /> Payment Methods Split
            </h3>
          </div>

          <div className="flex flex-col items-center gap-4 mt-2">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full rotate-[-90deg]">
                {paymentDonutPaths.length > 0 ? (
                  paymentDonutPaths.map((m, idx) => (
                    <path
                      key={idx}
                      d={m.pathD}
                      fill="none"
                      stroke={m.color}
                      strokeWidth="15"
                    />
                  ))
                ) : (
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#251416" strokeWidth="15" />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Method</span>
                <span className="text-xs font-bold text-white font-mono">Paid</span>
              </div>
            </div>

            {/* Legends list */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full text-xs">
              {paymentDonutPaths.map((m, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-zinc-400 uppercase font-medium">{m.name}:</span>
                  <span className="font-bold text-white font-mono">{m.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LEADERBOARDS & LIVE STREAM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Bestselling Dishes */}
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 shadow-soft flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#201011] pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-gold-555" /> Top Bestselling Food Items Today
            </h3>
          </div>

          <div className="flex flex-col gap-3.5 mt-1">
            {metrics.topSellingFood.length === 0 ? (
              <div className="p-8 text-center text-zinc-650 text-xs">
                No orders processed today yet.
              </div>
            ) : (
              metrics.topSellingFood.map((dish: any, idx: number) => {
                const maxQty = metrics.topSellingFood[0]?.quantity || 1;
                const widthPct = Math.max(10, Math.round((dish.quantity / maxQty) * 100));

                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-200 font-extrabold">
                        {idx + 1}. {dish.name}
                      </span>
                      <span className="text-zinc-400 font-mono">
                        {dish.quantity} ordered (₹{(dish.price * dish.quantity).toFixed(0)})
                      </span>
                    </div>

                    {/* Progress track */}
                    <div className="w-full h-2 rounded bg-zinc-950 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded transition-all duration-550"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Activity Log Stream */}
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 shadow-soft flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-[#201011] pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" /> Operational Live Activity Stream
            </h3>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex flex-col gap-3.5 mt-1 overflow-y-auto max-h-64 divide-y divide-[#201011]">
            {liveActivityFeed.length === 0 ? (
              <div className="p-8 text-center text-zinc-650 text-xs">
                No activity logs registered today.
              </div>
            ) : (
              liveActivityFeed.map((log: any) => (
                <div key={log.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-zinc-205">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        {log.user?.name || "System"}
                      </span>
                    </div>
                    <span className="text-zinc-400 block mt-1 text-[11px]">
                      {log.details || "Administrative event processed."}
                    </span>
                  </div>

                  <span className="text-[9px] text-zinc-600 shrink-0 font-medium">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
