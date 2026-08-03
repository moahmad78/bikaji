"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Sparkles,
  CreditCard,
  CheckCircle,
  HelpCircle,
  BellRing,
  Coffee,
  XCircle,
  AlertTriangle,
  User,
  Utensils,
  DollarSign,
  Briefcase,
  AlertCircle,
  Flame,
  CornerDownRight,
  Printer,
  Loader2
} from "lucide-react";
import { getWaiterDashboardData, resolveServiceRequest, serveOrder, processPayment, closeTable } from "@/actions/waiter";

// Local Interfaces
interface TableSession {
  id: string;
  customerName: string;
  phone: string | null;
  createdAt: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  specialNotes: string | null;
  deletedAt: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  gstAmount: number;
  serviceCharge: number;
  discountAmount: number;
  finalAmount: number;
  specialNotes: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface ServiceRequest {
  id: string;
  tableId: string;
  type: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface RestaurantTable {
  id: string;
  number: number;
  capacity: number;
  status: string;
  sessions: TableSession[];
  orders: Order[];
  serviceRequests: ServiceRequest[];
}

export default function TableDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tableId = params.tableId as string;

  // State
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Billing and Payment States
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("UPI");
  const [splitAmount, setSplitAmount] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);

  // Load table details function
  const fetchTableDetails = async () => {
    try {
      const res = await getWaiterDashboardData();
      if (res.success && res.tables) {
        const found = res.tables.find(t => t.id === tableId);
        if (found) {
          setTable(found as any);
          setError(null);
        } else {
          setError("Table not found in active floor layout.");
        }
      }
    } catch (err) {
      console.error("Error loading table details:", err);
      setError("Failed to fetch table operational details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tableId) {
      fetchTableDetails();
    }
  }, [tableId]);

  // Sockets integration for real-time table syncing
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

    // Refresh when events occur
    const handleEventTrigger = () => {
      fetchTableDetails();
    };

    socket.on("customer-request", handleEventTrigger);
    socket.on("request-resolved", handleEventTrigger);
    socket.on("order-new", handleEventTrigger);
    socket.on("order-accepted", handleEventTrigger);
    socket.on("order-preparing", handleEventTrigger);
    socket.on("order-ready", handleEventTrigger);
    socket.on("order-served", handleEventTrigger);
    socket.on("order-completed", handleEventTrigger);
    socket.on("payment-completed", handleEventTrigger);
    socket.on("table-closed", handleEventTrigger);

    return () => {
      socket.disconnect();
    };
  }, [tableId]);

  // Actions
  const handleResolveAlert = async (requestId: string) => {
    // Optimistic UI updates
    if (table) {
      setTable({
        ...table,
        serviceRequests: table.serviceRequests.filter(r => r.id !== requestId)
      });
    }
    const res = await resolveServiceRequest(requestId);
    if (!res.success) {
      fetchTableDetails();
      alert(res.error || "Failed to resolve request");
    }
  };

  const handleDeliverOrder = async (orderId: string) => {
    // Optimistic UI updates
    if (table) {
      setTable({
        ...table,
        orders: table.orders.map(o => o.id === orderId ? { ...o, status: "SERVED" } : o)
      });
    }
    const res = await serveOrder(orderId);
    if (!res.success) {
      fetchTableDetails();
      alert(res.error || "Failed to serve order");
    }
  };

  // Payment Confirmation
  const handlePaymentSubmit = async () => {
    if (!selectedOrderForPayment) return;
    setIsProcessingPayment(true);
    
    // Default to final invoice amount unless split bill is used
    const amount = paymentMethod === "SPLIT_BILL" && splitAmount 
      ? parseFloat(splitAmount) 
      : selectedOrderForPayment.finalAmount;

    try {
      const res = await processPayment(
        selectedOrderForPayment.id,
        paymentMethod as any,
        amount
      );

      if (res.success) {
        setShowPaymentModal(false);
        fetchTableDetails();
      } else {
        alert(res.error || "Failed to process payment.");
      }
    } catch (err) {
      console.error(err);
      alert("Error logging payment.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Close Session (Checkout table)
  const handleCloseSession = async () => {
    const confirmClose = confirm("Are you sure you want to CLOSE this session and free Table?");
    if (!confirmClose) return;

    setLoading(true);
    try {
      const res = await closeTable(tableId);
      if (res.success) {
        router.push("/waiter");
      } else {
        alert(res.error || "Failed to close table.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error closing table.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">Loading Table Details...</span>
      </div>
    );
  }

  if (error || !table) {
    return (
      <div className="bg-[#0e0708] text-white min-h-screen font-display flex flex-col justify-center items-center p-6 text-center">
        <XCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-lg font-bold mb-1">Retrieval Error</h2>
        <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">{error || "Failed to load table."}</p>
        <button
          onClick={() => router.push("/waiter")}
          className="px-6 py-2.5 bg-primary border border-gold-500/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const activeSession = table.sessions[0];
  const runningOrders = table.orders.filter(o => o.status !== "CANCELLED");
  const subtotalBill = runningOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const taxesBill = runningOrders.reduce((sum, o) => sum + o.gstAmount + o.serviceCharge, 0);
  const discountBill = runningOrders.reduce((sum, o) => sum + o.discountAmount, 0);
  const finalBill = runningOrders.reduce((sum, o) => sum + o.finalAmount, 0);

  return (
    <div className="bg-[#0e0708] text-white min-h-screen font-sans flex flex-col antialiased pb-12">
      {/* Header */}
      <header className="bg-[#1a0f11] border-b border-[#361f22] px-6 py-4 flex items-center justify-between shadow-large sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/waiter")}
            className="w-10 h-10 rounded-premium bg-[#251416] border border-[#361f22] text-[#baa47f] hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-extrabold text-sm tracking-tight text-white uppercase">
              TABLE {table.number} DETAILS
            </h1>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">
              {activeSession ? `Active Session: ${activeSession.customerName}` : "No Active Customer Session"}
            </span>
          </div>
        </div>

        {/* Action button to print bill summary or check status */}
        {activeSession && runningOrders.length > 0 && (
          <button
            onClick={() => window.print()}
            className="p-2.5 rounded-lg bg-[#251416] border border-[#361f22] text-[#baa47f] hover:text-white transition cursor-pointer"
            title="Print order ticket summary"
          >
            <Printer className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Main layout grid */}
      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
        
        {/* Table Alerts / Customer Requests Section */}
        {table.serviceRequests.length > 0 && (
          <section className="bg-red-950/20 border border-red-500/30 rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-4 h-4 text-red-500" /> Pending Table Assistance Calls
            </h3>
            
            <div className="flex flex-col gap-2">
              {table.serviceRequests.map(req => (
                <div
                  key={req.id}
                  className="bg-black/30 border border-[#361f22] px-4 py-3 rounded-lg flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider block">
                      {req.type === "BILL" ? "Bill Check Out Request" : req.notes || "Assistance Call"}
                    </span>
                    <span className="text-[9px] text-zinc-550 block font-bold mt-0.5">
                      Requested at: {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleResolveAlert(req.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
                  >
                    Complete Request
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Current Active Orders Ticket Section */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Order Tickets</h3>
          
          {runningOrders.length === 0 ? (
            <div className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-6 text-center text-zinc-500">
              <Utensils className="w-10 h-10 text-zinc-650 mx-auto mb-2" />
              <p className="text-xs">No active orders placed by table guests yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {runningOrders.map(order => {
                const isReady = order.status === "READY";
                const isServed = order.status === "SERVED" || order.status === "COMPLETED";

                return (
                  <div
                    key={order.id}
                    className={`bg-[#1c0f11] border rounded-xl overflow-hidden shadow-soft ${
                      isReady ? "border-emerald-600/40" : "border-[#361f22]"
                    }`}
                  >
                    {/* Header */}
                    <div className="bg-[#14080a] border-b border-[#251416] px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-white font-display">
                          Ticket {order.orderNumber}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-bold ml-2">
                          Ordered: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          isReady 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                            : isServed
                            ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                            : "bg-blue-600/15 border-blue-600/20 text-blue-400"
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-xs pb-1.5 border-b border-[#251416] last:border-0">
                            <span className="text-zinc-200 font-medium">
                              {item.name} <span className="text-[10px] text-zinc-500 ml-1">× {item.quantity}</span>
                            </span>
                            <span className="text-zinc-400 font-mono">₹{(item.price * item.quantity).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>

                      {order.specialNotes && (
                        <div className="p-2.5 bg-black/20 border border-[#361f22] rounded-lg text-[10px] text-zinc-300 italic">
                          Instructions: "{order.specialNotes}"
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="px-4 py-3 bg-[#14080a] border-t border-[#251416] flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Total: <span className="text-white font-mono">₹{order.finalAmount.toFixed(0)}</span>
                      </span>

                      <div className="flex gap-2">
                        {/* Collect Payment option */}
                        {order.paymentStatus !== "PAID" && (
                          <button
                            onClick={() => {
                              setSelectedOrderForPayment(order);
                              setPaymentMethod("UPI");
                              setShowPaymentModal(true);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer"
                          >
                            Collect Bill
                          </button>
                        )}
                        {order.paymentStatus === "PAID" && (
                          <span className="px-2.5 py-1 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase tracking-wide">
                            PAID
                          </span>
                        )}

                        {/* Deliver order option */}
                        {isReady && (
                          <button
                            onClick={() => handleDeliverOrder(order.id)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-extrabold uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1 animate-pulse"
                          >
                            Deliver <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Running Bill Totals & Checkout Section */}
        {activeSession && runningOrders.length > 0 && (
          <section className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-5 shadow-soft flex flex-col gap-4">
            <h3 className="text-xs font-bold text-zinc-450 uppercase tracking-wider border-b border-[#251416] pb-2">
              Cumulative Table Running Bill
            </h3>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Total Subtotal:</span>
                <span className="font-mono">₹{subtotalBill.toFixed(2)}</span>
              </div>
              {discountBill > 0 && (
                <div className="flex justify-between text-xs text-emerald-400 font-bold">
                  <span>Coupon Discounts:</span>
                  <span className="font-mono">-₹{discountBill.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Taxes & GST (5%):</span>
                <span className="font-mono">₹{(runningOrders.reduce((sum, o) => sum + o.gstAmount, 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Service Charge (5%):</span>
                <span className="font-mono">₹{(runningOrders.reduce((sum, o) => sum + o.serviceCharge, 0)).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-sm font-extrabold text-white border-t border-[#251416] pt-3 mt-1">
                <span>Final Bill Amount:</span>
                <span className="text-gold-400 font-display text-base font-extrabold font-mono">
                  ₹{finalBill.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Check Out button - active when all orders are paid */}
            <div className="pt-2 border-t border-[#251416] flex justify-end">
              {runningOrders.every(o => o.paymentStatus === "PAID") ? (
                <button
                  onClick={handleCloseSession}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-lg transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Close Table & Release
                </button>
              ) : (
                <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 text-[10px] font-bold uppercase rounded-lg flex items-center gap-2 w-full text-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>All active ticket bills must be paid before closing table</span>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Modal: COLLECT BILL & PROCESS PAYMENT */}
      <AnimatePresence>
        {showPaymentModal && selectedOrderForPayment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c0f11] border border-[#361f22] rounded-xl p-6 w-full max-w-sm shadow-modal flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#361f22]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  Payment: Ticket {selectedOrderForPayment.orderNumber}
                </h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Total description */}
              <div className="bg-[#14080a] p-4 rounded-lg border border-[#251416] text-center">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Amount Due:</span>
                <span className="text-2xl font-display font-extrabold text-gold-400 block mt-1 font-mono">
                  ₹{selectedOrderForPayment.finalAmount.toFixed(2)}
                </span>
              </div>

              {/* Payment Methods */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Payment Method:</span>
                <div className="grid grid-cols-2 gap-2">
                  {["UPI", "CASH", "CARD", "SPLIT_BILL"].map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                        paymentMethod === method
                          ? "bg-primary border-gold-500/25 text-white"
                          : "bg-[#251416] border-[#361f22] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {method.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split bill inputs */}
              {paymentMethod === "SPLIT_BILL" && (
                <div className="flex flex-col gap-1.5 animate-fadeIn">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Split Payment Amount (INR)</label>
                  <input
                    type="number"
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-[#14080a] border border-[#361f22] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 focus:outline-none"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#361f22] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={isProcessingPayment}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-md flex items-center justify-center gap-1"
                >
                  {isProcessingPayment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                  Confirm Paid
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
