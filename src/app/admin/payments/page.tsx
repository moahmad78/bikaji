"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getAdminOrders } from "@/actions/admin";
import { confirmPayment } from "@/actions/payment";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Search,
  CheckCircle,
  X,
  CreditCard,
  IndianRupee,
  Clock,
  ChevronRight,
  Filter,
  DollarSign
} from "lucide-react";
import ThermalInvoice from "@/components/ThermalInvoice";
import { authClient } from "@/lib/auth-client";

// Local types based on prisma schema expectation
type Order = any; // simplified for client-side state

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "CASH" | "PAY_ON_EXIT" | "PAID">("ALL");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Auth fetch
  useEffect(() => {
    async function loadUser() {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setAdminUserId(data.user.id);
      }
    }
    loadUser();
  }, []);

  // Data Fetch
  const loadData = async () => {
    try {
      const orderRes = await getAdminOrders();
      if (orderRes.success && orderRes.orders) {
        setOrders(orderRes.orders);
        setError(null);
        
        // If an order is selected, update it
        if (selectedOrder) {
            const updated = orderRes.orders.find((o: any) => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
        }
      } else {
        setError(orderRes.error || "Failed to load orders.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading order list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Socket
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
      console.log("[Admin Payments] Connected to Real-time Server");
    });

    socket.on("ORDER_CREATED", () => loadData());
    socket.on("ORDER_UPDATED", () => loadData());
    socket.on("PAYMENT_CASH_REQUESTED", () => loadData());
    socket.on("PAYMENT_COMPLETED", () => loadData());

    return () => {
      socket.disconnect();
    };
  }, []);

  // Filtered logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(order.table?.number).includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Filter logic
      if (statusFilter === "PENDING" && order.paymentStatus !== "PENDING") return false;
      if (statusFilter === "PAID" && order.paymentStatus !== "PAID") return false;
      if (statusFilter === "CASH" && order.paymentMethod !== "CASH") return false;
      if (statusFilter === "PAY_ON_EXIT" && order.paymentMethod !== "PAY_ON_EXIT") return false;

      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    let todaysCollected = 0;
    let pendingPayments = 0;
    let cashCollected = 0;
    let payOnExitPending = 0;
    let paidOrders = 0;
    let pendingOrders = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    orders.forEach(order => {
      const isToday = new Date(order.createdAt) >= todayStart;
      if (!isToday) return; // Only count today's for metrics

      if (order.status === "CANCELLED" || order.status === "REFUNDED") return;

      if (order.paymentStatus === "PAID") {
        todaysCollected += order.finalAmount;
        paidOrders++;
        if (order.paymentMethod === "CASH") {
          cashCollected += order.finalAmount;
        }
      } else if (order.paymentStatus === "PENDING") {
        pendingPayments += order.finalAmount;
        pendingOrders++;
        if (order.paymentMethod === "PAY_ON_EXIT") {
          payOnExitPending += order.finalAmount;
        }
      }
    });

    return { todaysCollected, pendingPayments, cashCollected, payOnExitPending, paidOrders, pendingOrders };
  }, [orders]);

  // Actions
  const handleCollectPayment = async (orderId: string, amount: number) => {
    const confirmAction = confirm(`Confirm that ₹${amount.toFixed(2)} cash has been received?`);
    if (!confirmAction) return;

    if (!adminUserId) return;
    setIsProcessingAction(true);
    try {
      const res = await confirmPayment(orderId, "CASH");
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        loadData();
      } else {
        alert(res.error || "Failed to confirm payment.");
      }
    } catch (err) {
      console.error(err);
      alert("Error confirming payment.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading payments...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full print:hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-black tracking-tight text-white uppercase flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-500" />
            Payment Management
          </h1>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
            Real-time payment queue & collections
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#140b0c] p-4 rounded-xl border border-[#251416] flex flex-col gap-1">
          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Today's Collected</span>
          <span className="text-lg font-black text-emerald-400 tracking-tight">₹{metrics.todaysCollected.toFixed(0)}</span>
        </div>
        <div className="bg-[#140b0c] p-4 rounded-xl border border-[#251416] flex flex-col gap-1">
          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Pending Payments</span>
          <span className="text-lg font-black text-amber-500 tracking-tight">₹{metrics.pendingPayments.toFixed(0)}</span>
        </div>
        <div className="bg-[#140b0c] p-4 rounded-xl border border-[#251416] flex flex-col gap-1">
          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Cash Collected</span>
          <span className="text-lg font-black text-emerald-500 tracking-tight">₹{metrics.cashCollected.toFixed(0)}</span>
        </div>
        <div className="bg-[#140b0c] p-4 rounded-xl border border-[#251416] flex flex-col gap-1">
          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Pay on Exit Pending</span>
          <span className="text-lg font-black text-amber-500 tracking-tight">₹{metrics.payOnExitPending.toFixed(0)}</span>
        </div>
        <div className="bg-[#140b0c] p-4 rounded-xl border border-[#251416] flex flex-col gap-1">
          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Paid Orders</span>
          <span className="text-lg font-black text-white tracking-tight">{metrics.paidOrders}</span>
        </div>
        <div className="bg-[#140b0c] p-4 rounded-xl border border-[#251416] flex flex-col gap-1">
          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Pending Orders</span>
          <span className="text-lg font-black text-white tracking-tight">{metrics.pendingOrders}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-[#140b0c] p-2 rounded-xl border border-[#251416]">
        {/* Tabs */}
        <div className="flex w-full lg:w-auto overflow-x-auto snap-x hide-scrollbar">
          {["ALL", "PENDING", "CASH", "PAY_ON_EXIT", "PAID"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab as any)}
              className={`snap-center px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg shrink-0 transition ${
                statusFilter === tab 
                  ? "bg-[#251416] text-[#baa47f]" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1a0e10]"
              }`}
            >
              {tab.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search Order ID / Table / Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d0506] border border-[#251416] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#baa47f]/40 transition"
          />
        </div>
      </div>

      {/* Payment Data Table */}
      {error ? (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-400">Error Loading Payments</h3>
            <p className="text-xs text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-[#140b0c] border border-[#251416] border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <IndianRupee className="w-12 h-12 text-zinc-800 mb-4" />
          <h3 className="text-sm font-bold text-zinc-400">No Payments Found</h3>
          <p className="text-xs text-zinc-600 mt-2">Adjust your search or filters to see results.</p>
        </div>
      ) : (
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#201011] border-b border-[#251416] text-[10px] text-zinc-450 uppercase tracking-widest font-extrabold">
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Table</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Payment Method</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Order Time</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#201011]">
                {filteredOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-[#1c0e10]/40 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-extrabold text-white">
                      #{order.orderNumber}
                    </td>
                    <td className="px-6 py-4 font-bold text-[#baa47f]">
                      Table {order.table?.number || "?"}
                    </td>
                    <td className="px-6 py-4 font-mono font-extrabold text-white">
                      ₹{order.finalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-zinc-300 uppercase">
                        {order.paymentMethod?.replace(/_/g, " ") || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        order.paymentStatus === "PAID"
                          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                          : "bg-amber-600/10 border-amber-650/20 text-amber-500 animate-pulse"
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {order.paymentStatus === "PENDING" ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                        >
                          Collect
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                          className="px-3 py-1.5 bg-[#251416] hover:bg-[#361f22] text-[#baa47f] hover:text-white rounded text-[10px] font-extrabold uppercase tracking-wider border border-[#361f22] cursor-pointer"
                        >
                          Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENT DETAIL DRAWER/MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end print:bg-white print:items-start print:justify-center">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="bg-[#140b0c] border-l border-[#251416] w-full max-w-lg h-full flex flex-col shadow-large overflow-hidden print:w-full print:max-w-none print:h-auto print:border-none print:shadow-none"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#1c0f11] border-b border-[#251416] flex justify-between items-center shrink-0 print:hidden">
                <div>
                  <h3 className="font-display font-extrabold text-sm tracking-tight text-white uppercase flex items-center gap-1.5">
                    Payment Details: #{selectedOrder.orderNumber}
                  </h3>
                  <span className="text-[9px] text-[#baa47f] font-bold uppercase tracking-wider block mt-0.5">
                    Table {selectedOrder.table?.number} • {selectedOrder.customerName}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 print:p-0 print:overflow-visible">
                
                {selectedOrder.paymentStatus === "PAID" ? (
                  <div className="flex flex-col items-center">
                    <div className="mb-6 flex flex-col items-center gap-2 print:hidden">
                      <CheckCircle className="w-12 h-12 text-emerald-500" />
                      <h2 className="text-lg font-black text-white uppercase tracking-wider">Payment Received</h2>
                      <p className="text-xs text-zinc-400">Order #{selectedOrder.orderNumber} is settled.</p>
                    </div>
                    
                    <ThermalInvoice
                      order={selectedOrder}
                      invoiceNumber={`INV-${selectedOrder.orderNumber}`}
                      billingDetails={{
                        subtotal: selectedOrder.totalAmount,
                        discountAmount: selectedOrder.discountAmount,
                        gstAmount: selectedOrder.gstAmount,
                        cgstAmount: selectedOrder.gstAmount / 2,
                        sgstAmount: selectedOrder.gstAmount / 2,
                        serviceCharge: selectedOrder.serviceCharge,
                        roundOff: 0,
                        finalAmount: selectedOrder.finalAmount
                      }}
                      settings={{
                        name: "BIKAJI RESTAURANT",
                        address: "123 Food Street, Culinary District\nCity Center, 400001",
                        phone: "+91 98765 43210",
                        currency: "INR"
                      }}
                      paymentMethod={selectedOrder.paymentMethod}
                      cashierName="Admin User"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="bg-[#0e0708] border border-[#251416] p-6 rounded-xl flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-400 font-bold uppercase">Amount Due</span>
                        <span className="text-2xl font-black text-emerald-400 tracking-tight">₹{selectedOrder.finalAmount.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-[#201011] pt-4">
                        <span className="text-xs text-zinc-400 font-bold uppercase">Payment Method</span>
                        <span className="text-sm font-black text-white uppercase tracking-widest">{selectedOrder.paymentMethod?.replace(/_/g, " ")}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Itemized Breakdown</h4>
                      <div className="flex flex-col gap-2.5 bg-[#140b0c] p-4 border border-[#251416] rounded-xl">
                        {selectedOrder.items?.map((item: any) => (
                          <div key={item.id} className="pb-2 border-b border-[#201011] last:border-0 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-extrabold text-zinc-200">{item.name}</span>
                              <span className="text-[10px] text-zinc-500 block mt-0.5">Qty: {item.quantity} × ₹{item.price}</span>
                            </div>
                            <span className="font-mono font-bold text-white">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 bg-[#0e0708] border border-[#251416] p-4 rounded-xl">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Subtotal Price:</span>
                        <span className="font-mono">₹{selectedOrder.totalAmount.toFixed(2)}</span>
                      </div>
                      {selectedOrder.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-emerald-400 font-bold">
                          <span>Discounts:</span>
                          <span className="font-mono">-₹{selectedOrder.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Taxes & GST (5%):</span>
                        <span className="font-mono">₹{selectedOrder.gstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Service Charges (5%):</span>
                        <span className="font-mono">₹{selectedOrder.serviceCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-extrabold text-white border-t border-[#201011] pt-3 mt-1">
                        <span>Invoice Final Amount:</span>
                        <span className="text-gold-400 font-mono text-base font-extrabold">₹{selectedOrder.finalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#251416]">
                      <p className="text-xs text-zinc-400 mb-4 text-center">
                        Confirm that ₹{selectedOrder.finalAmount.toFixed(2)} has been successfully received?
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedOrder(null)}
                          className="flex-1 px-4 py-3 rounded-lg border border-[#361f22] text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition text-center"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleCollectPayment(selectedOrder.id, selectedOrder.finalAmount)}
                          disabled={isProcessingAction}
                          className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 transition shadow-md cursor-pointer text-center flex justify-center items-center gap-2"
                        >
                          {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Payment"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
