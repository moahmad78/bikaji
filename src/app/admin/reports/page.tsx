"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Loader2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  Search
} from "lucide-react";
import { getFinancialReport, calculateOrderBill } from "@/actions/billing";
import { getAdminOrders } from "@/actions/admin";

export default function AdminReportsPage() {
  // Data State
  const [report, setReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [startDateStr, setStartDateStr] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [endDateStr, setEndDateStr] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadReport = async () => {
    try {
      const start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);

      const reportRes = await getFinancialReport(start, end);
      const ordersRes = await getAdminOrders();

      if (reportRes.success && reportRes.report) {
        setReport(reportRes.report);
        setError(null);
      } else {
        setError(reportRes.error || "Failed to load financial report data.");
      }

      if (ordersRes.success && ordersRes.orders) {
        // Filter orders in date range
        const filtered = ordersRes.orders.filter((o: any) => {
          const dt = new Date(o.createdAt);
          return dt >= start && dt <= end;
        });
        setOrders(filtered);
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading report files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDateStr, endDateStr]);

  // Export CSV Action helper
  const handleExportCSV = () => {
    if (orders.length === 0) return;
    
    // Header row
    const headers = ["Invoice Date", "Invoice Number", "Table", "Customer Name", "Payment Method", "Status", "Subtotal", "Tax", "Discount", "Grand Total"];
    
    // Data rows
    const rows = orders.map(order => [
      new Date(order.createdAt).toLocaleDateString(),
      `INV-${order.orderNumber}`,
      `Table ${order.table?.number || "QR"}`,
      order.customerName || "Anonymous Guest",
      order.paymentMethod || "UPI",
      order.paymentStatus,
      order.totalAmount || order.finalAmount,
      order.gstAmount || 0,
      order.discountAmount || 0,
      order.finalAmount
    ]);

    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bikaji_Collections_Report_${startDateStr}_to_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Search Filtered Orders
  const searchedOrders = useMemo(() => {
    return orders.filter(o => 
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [orders, searchQuery]);

  // Calculations for custom SVG charts
  const collectionPercentages = useMemo(() => {
    if (!report) return { cash: 0, upi: 0, card: 0 };
    const total = report.cashCollection + report.upiCollection + report.cardCollection || 1;
    return {
      cash: Math.round((report.cashCollection / total) * 100),
      upi: Math.round((report.upiCollection / total) * 100),
      card: Math.round((report.cardCollection / total) * 100)
    };
  }, [report]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-555">Structuring financial records...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Collections & Reports
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Audit daily receipts and export transactional financial statements
          </p>
        </div>

        {orders.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-primary hover:bg-[#871b30] border border-[#baa47f]/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
        )}
      </div>

      {/* Date Range selectors */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-[#140b0c] p-4 border border-[#251416] rounded-xl shadow-soft">
        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-zinc-650 shrink-0" />
          <span className="text-zinc-500 font-bold uppercase tracking-wide">Select Range:</span>
        </div>

        <div className="flex gap-2 w-full sm:w-auto items-center">
          <input
            type="date"
            value={startDateStr}
            onChange={(e) => setStartDateStr(e.target.value)}
            className="bg-[#0d0506] border border-[#2d191b] text-zinc-350 text-xs rounded-lg px-3 py-2.5 w-full sm:w-auto focus:outline-none focus:border-[#baa47f]/30"
          />
          <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
          <input
            type="date"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            className="bg-[#0d0506] border border-[#2d191b] text-zinc-350 text-xs rounded-lg px-3 py-2.5 w-full sm:w-auto focus:outline-none focus:border-[#baa47f]/30"
          />
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
          <h2 className="text-lg font-bold">Failed to load financial data</h2>
          <p className="text-xs text-zinc-450 mt-1 max-w-xs">{error}</p>
        </div>
      ) : (
        <>
          {/* KPI METRIC SUMMARY GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative shadow-soft">
              <div className="flex justify-between items-start text-zinc-550">
                <span className="text-[10px] font-bold uppercase tracking-wider">Gross Collections</span>
                <DollarSign className="w-4 h-4 text-gold-555" />
              </div>
              <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
                ₹{(report.cashCollection + report.upiCollection + report.cardCollection).toFixed(0)}
              </h2>
              <span className="text-[9px] text-zinc-500 font-medium">Total logged receipts</span>
            </div>

            <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative shadow-soft">
              <div className="flex justify-between items-start text-zinc-550">
                <span className="text-[10px] font-bold uppercase tracking-wider">Net Sales</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
                ₹{report.netCollection.toFixed(0)}
              </h2>
              <span className="text-[9px] text-emerald-400 font-bold">Total net cashflow</span>
            </div>

            <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative shadow-soft">
              <div className="flex justify-between items-start text-zinc-550">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Refunds</span>
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
                ₹{report.totalRefunded.toFixed(0)}
              </h2>
              <span className="text-[9px] text-red-400 font-bold">Voided returns</span>
            </div>

            <div className="bg-[#140b0c] border border-[#251416] p-4 rounded-xl flex flex-col gap-2 relative shadow-soft">
              <div className="flex justify-between items-start text-zinc-550">
                <span className="text-[10px] font-bold uppercase tracking-wider">Invoice Count</span>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-xl md:text-2xl font-mono font-extrabold text-white">
                {report.transactionCount}
              </h2>
              <span className="text-[9px] text-zinc-500 font-medium">Printed checks</span>
            </div>
          </div>

          {/* METHOD GRAPH SPLIT & INVOICES TABLE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Visual SVG bar graphs */}
            <div className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 shadow-soft flex flex-col gap-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#201011] pb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-400" /> Collections By Payment Method
              </h3>

              <div className="flex flex-col gap-4 mt-2">
                {/* Method 1 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-semibold uppercase">UPI:</span>
                    <span className="font-bold text-white font-mono">₹{report.upiCollection.toFixed(0)} ({collectionPercentages.upi}%)</span>
                  </div>
                  <div className="w-full h-2 rounded bg-zinc-950 overflow-hidden">
                    <div className="h-full bg-primary rounded" style={{ width: `${collectionPercentages.upi}%` }} />
                  </div>
                </div>

                {/* Method 2 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-semibold uppercase">Cash:</span>
                    <span className="font-bold text-white font-mono">₹{report.cashCollection.toFixed(0)} ({collectionPercentages.cash}%)</span>
                  </div>
                  <div className="w-full h-2 rounded bg-zinc-950 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded" style={{ width: `${collectionPercentages.cash}%` }} />
                  </div>
                </div>

                {/* Method 3 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-semibold uppercase">Card:</span>
                    <span className="font-bold text-white font-mono">₹{report.cardCollection.toFixed(0)} ({collectionPercentages.card}%)</span>
                  </div>
                  <div className="w-full h-2 rounded bg-zinc-950 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded" style={{ width: `${collectionPercentages.card}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices List table */}
            <div className="bg-[#140b0c] border border-[#251416] rounded-xl p-5 shadow-soft md:col-span-2 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-[#201011] pb-2 flex-wrap gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-gold-555" /> Invoices In Date Range ({searchedOrders.length})
                </h3>

                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 text-zinc-650 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search invoice..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-7 pr-3 py-1.5 text-[10px] text-white placeholder-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#201011] text-[9px] text-zinc-550 uppercase tracking-widest font-extrabold">
                      <th className="py-2">Date</th>
                      <th className="py-2">Invoice</th>
                      <th className="py-2">Table</th>
                      <th className="py-2">Method</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#201011] text-zinc-300">
                    {searchedOrders.map((order, idx) => (
                      <tr key={idx} className="hover:bg-[#1c0e10]/30 transition">
                        <td className="py-3 font-mono text-[10px] text-zinc-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-mono font-extrabold text-white">
                          INV-{order.orderNumber}
                        </td>
                        <td className="py-3 font-bold text-[#baa47f]">
                          T{order.table?.number || "QR"}
                        </td>
                        <td className="py-3">
                          <span className="text-[8px] bg-zinc-950 border border-zinc-850 text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase">
                            {order.paymentMethod || "UPI"}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-extrabold text-white">
                          ₹{order.finalAmount.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
