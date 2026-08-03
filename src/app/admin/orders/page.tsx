"use client";

import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
  Printer,
  CheckCircle,
  XCircle,
  TrendingUp,
  User,
  Coffee,
  X,
  CreditCard,
  UserCheck
} from "lucide-react";
import {
  getAdminOrders,
  updateAdminOrderStatus,
  cancelOrRefundAdminOrder,
  getAdminStaff,
  assignWaiterToTable
} from "@/actions/admin";
import { authClient } from "@/lib/auth-client";

export default function AdminOrdersPage() {
  // Data State
  const [orders, setOrders] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>("");

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal / Detail Panel State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [assignedWaiterId, setAssignedWaiterId] = useState<string>("");

  // Fetch Session User ID for logging activity
  useEffect(() => {
    async function loadUser() {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setAdminUserId(data.user.id);
      }
    }
    loadUser();
  }, []);

  const loadData = async () => {
    try {
      const orderRes = await getAdminOrders();
      const staffRes = await getAdminStaff();
      
      if (orderRes.success && orderRes.orders) {
        setOrders(orderRes.orders);
        setError(null);
      } else {
        setError(orderRes.error || "Failed to load orders.");
      }

      if (staffRes.success && staffRes.staff) {
        setStaff(staffRes.staff);
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

  // Real-time socket sync
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      socket.emit("admin-connected");
    });

    const handleEventTrigger = (updatedOrder: any) => {
      if (!updatedOrder || !updatedOrder.id) return;
      setOrders(prev => {
        const exists = prev.find(o => o.id === updatedOrder.id);
        if (exists) {
          return prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
        } else {
          return [updatedOrder, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      });
      // Optionally update selectedOrder if it's the one currently open
      setSelectedOrder((prev: any) => (prev?.id === updatedOrder.id ? { ...prev, ...updatedOrder } : prev));
    };

    const events = [
      "ORDER_CREATED", "ORDER_ACCEPTED", "ORDER_COOKING", "ORDER_READY",
      "WAITER_ASSIGNED", "ORDER_PICKED_UP", "ORDER_DELIVERED",
      "ORDER_COMPLETED", "ORDER_CANCELLED", "ORDER_DELAYED",
      "ORDER_UPDATED", "CUSTOMER_REPLY", "PAYMENT_COMPLETED"
    ];

    events.forEach(evt => socket.on(evt, handleEventTrigger));

    return () => {
      events.forEach(evt => socket.off(evt, handleEventTrigger));
      socket.disconnect();
    };
  }, []);

  // Set waiter selection when order changes
  useEffect(() => {
    if (selectedOrder?.tableId) {
      // Find if waiter is already assigned to this table
      const assignedWaiter = staff.find(s => 
        s.waiterProfile?.isAvailable && 
        s.waiterProfile?.id && 
        // We can just display empty selection by default to let them reassign
        false
      );
      setAssignedWaiterId("");
    }
  }, [selectedOrder, staff]);

  // Actions
  const handleStatusChange = async (orderId: string, status: string) => {
    if (!adminUserId) return;
    setIsProcessingAction(true);
    try {
      const res = await updateAdminOrderStatus(orderId, status as any, adminUserId);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        loadData();
      } else {
        alert(res.error || "Failed to update order status.");
      }
    } catch (err) {
      console.error(err);
      alert("Error changing status.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancelOrRefund = async (orderId: string, isRefund: boolean) => {
    const actionStr = isRefund ? "REFUND" : "CANCEL";
    const confirmAction = confirm(`Are you sure you want to ${actionStr} this order?`);
    if (!confirmAction) return;

    if (!adminUserId) return;
    setIsProcessingAction(true);
    try {
      const res = await cancelOrRefundAdminOrder(orderId, isRefund, adminUserId);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        loadData();
      } else {
        alert(res.error || `Failed to process ${actionStr.toLowerCase()}.`);
      }
    } catch (err) {
      console.error(err);
      alert("Error processing transaction action.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleAssignWaiter = async () => {
    if (!selectedOrder?.tableId || !assignedWaiterId || !adminUserId) return;
    setIsProcessingAction(true);
    try {
      const waiter = staff.find(s => s.id === assignedWaiterId);
      if (!waiter?.waiterProfile?.id) {
        alert("Selected user does not have a valid waiter profile.");
        setIsProcessingAction(false);
        return;
      }

      const res = await assignWaiterToTable(
        selectedOrder.tableId,
        waiter.waiterProfile.id,
        adminUserId
      );

      if (res.success) {
        alert("Waiter assigned to table successfully.");
        loadData();
      } else {
        alert(res.error || "Failed to assign waiter.");
      }
    } catch (err) {
      console.error(err);
      alert("Error assigning waiter.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Waiters list selector mapping
  const waiters = useMemo(() => {
    return staff.filter(s => s.role === "WAITER");
  }, [staff]);

  // Filters application
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;

      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Order Console
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Monitor and manage active customer bills
          </p>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#140b0c] p-3 border border-[#251416] rounded-xl shadow-soft">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Ticket ID or Guest Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0d0506] border border-[#2d191b] text-zinc-400 text-xs rounded-lg px-3 py-2.5 w-full md:w-44 focus:outline-none"
        >
          <option value="ALL">All Order Statuses</option>
          <option value="PENDING">Pending (New)</option>
          <option value="ACCEPTED">Cooking Accepted</option>
          <option value="PREPARING">Preparing In Kitchen</option>
          <option value="READY">Ready to Deliver</option>
          <option value="SERVED">Served at Table</option>
          <option value="COMPLETED">Invoice Closed</option>
          <option value="CANCELLED">Voided / Cancelled</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="h-60 flex flex-col justify-center items-center border border-dashed border-[#251416] rounded-xl text-center text-zinc-550 p-6">
          <Clock className="w-10 h-10 text-zinc-750 mb-2" />
          <h3 className="text-sm font-bold text-zinc-400">No matching tickets</h3>
          <p className="text-[10px]">No orders currently match the specified filters.</p>
        </div>
      ) : (
        <div className="bg-[#140b0c] border border-[#251416] rounded-xl overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#201011] border-b border-[#251416] text-[10px] text-zinc-450 uppercase tracking-widest font-extrabold">
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Table</th>
                  <th className="px-6 py-4">Guest Info</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Total Bill</th>
                  <th className="px-6 py-4 text-right">Details</th>
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
                      Table {order.table.number}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-extrabold text-zinc-200 block">
                        {order.customerName}
                      </span>
                      <span className="text-[10px] text-zinc-550 block mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        order.status === "COMPLETED"
                          ? "bg-zinc-950 border-zinc-800 text-zinc-500"
                          : order.status === "READY"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                          : order.status === "CANCELLED" || order.status === "REFUNDED"
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-blue-600/10 border-blue-600/20 text-blue-400"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        order.paymentStatus === "PAID"
                          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                          : "bg-amber-600/10 border-amber-650/20 text-amber-500"
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-extrabold text-white">
                      ₹{order.finalAmount.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1 text-[#baa47f] hover:text-white cursor-pointer">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDER DETAIL INSPECT PANEL (Modal Overlay) */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="bg-[#140b0c] border-l border-[#251416] w-full max-w-lg h-full flex flex-col shadow-large overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#1c0f11] border-b border-[#251416] flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-display font-extrabold text-sm tracking-tight text-white uppercase flex items-center gap-1.5">
                    Ticket details: #{selectedOrder.orderNumber}
                  </h3>
                  <span className="text-[9px] text-[#baa47f] font-bold uppercase tracking-wider block mt-0.5">
                    Table {selectedOrder.table.number} • {selectedOrder.customerName}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Scroll View */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                
                {/* Status state transitions panel */}
                <div className="bg-[#0e0708] border border-[#251416] p-4 rounded-xl flex flex-col gap-3">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">
                    Quick Operational Actions
                  </span>
                  
                  <div className="flex gap-2 flex-wrap">
                    {/* Status updates */}
                    {["ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED"].map(status => {
                      const isActive = selectedOrder.status === status;
                      return (
                        <button
                          key={status}
                          disabled={isActive || isProcessingAction}
                          onClick={() => handleStatusChange(selectedOrder.id, status)}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase transition cursor-pointer ${
                            isActive
                              ? "bg-primary text-white border border-[#baa47f]/20"
                              : "bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>

                  {/* Void or Refund */}
                  {selectedOrder.status !== "CANCELLED" && selectedOrder.status !== "REFUNDED" && (
                    <div className="flex gap-2 pt-2 border-t border-[#201011]">
                      <button
                        onClick={() => handleCancelOrRefund(selectedOrder.id, false)}
                        disabled={isProcessingAction}
                        className="px-3 py-1.5 rounded bg-red-950/20 border border-red-500/30 text-red-400 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                      >
                        Void Ticket
                      </button>
                      {selectedOrder.paymentStatus === "PAID" && (
                        <button
                          onClick={() => handleCancelOrRefund(selectedOrder.id, true)}
                          disabled={isProcessingAction}
                          className="px-3 py-1.5 rounded bg-amber-600/10 border border-amber-600/30 text-amber-500 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                        >
                          Refund Invoice
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Waiter Assignment section */}
                <div className="bg-[#0e0708] border border-[#251416] p-4 rounded-xl flex flex-col gap-3">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-gold-555" /> Floor Waiter Assignment
                  </span>

                  <div className="flex gap-2">
                    <select
                      value={assignedWaiterId}
                      onChange={(e) => setAssignedWaiterId(e.target.value)}
                      className="bg-zinc-950 border border-zinc-850 text-zinc-350 text-xs rounded-lg px-3 py-2 flex-1 focus:outline-none"
                    >
                      <option value="">Select Waiter to assign...</option>
                      {waiters.map(waiter => (
                        <option key={waiter.id} value={waiter.id}>
                          {waiter.name} ({waiter.waiterProfile?.employeeId || "WT"})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAssignWaiter}
                      disabled={!assignedWaiterId || isProcessingAction}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold uppercase tracking-wider disabled:opacity-50 transition cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                {/* Admin Delivery Timeline: Ready -> Picked Up -> Delivered */}
                <div className="bg-[#0e0708] border border-[#251416] p-4 rounded-xl flex flex-col gap-2">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                    📜 Admin Delivery Timeline (Ready → Picked Up → Delivered)
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-[#14080a] p-2.5 rounded-lg border border-[#251416] text-[10px]">
                    <div>
                      <span className="text-zinc-500 uppercase font-bold block">1. Ready</span>
                      <span className="text-amber-400 font-mono font-semibold">
                        {selectedOrder.readyAt ? new Date(selectedOrder.readyAt).toLocaleTimeString() : "Pending"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase font-bold block">2. Picked Up</span>
                      <span className="text-blue-400 font-mono font-semibold">
                        {selectedOrder.waiterAcceptedAt ? new Date(selectedOrder.waiterAcceptedAt).toLocaleTimeString() : "Pending"}
                      </span>
                      {selectedOrder.waiterName && (
                        <span className="text-[9px] text-blue-300 block truncate">By {selectedOrder.waiterName}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase font-bold block">3. Delivered</span>
                      <span className="text-emerald-400 font-mono font-semibold">
                        {selectedOrder.deliveredAt ? new Date(selectedOrder.deliveredAt).toLocaleTimeString() : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Waiter Delivery Audit Info */}
                {selectedOrder.waiterName && (
                  <div className="bg-[#0e0708] border border-blue-500/30 p-4 rounded-xl flex flex-col gap-1.5">
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-400" /> Waiter Delivery Audit
                    </span>
                    <div className="text-xs text-zinc-300 flex flex-col gap-1 mt-1">
                      <div><span className="text-zinc-500">Accepted By:</span> <strong className="text-white">{selectedOrder.waiterName}</strong></div>
                      {selectedOrder.waiterAcceptedAt && (
                        <div><span className="text-zinc-500">Accepted At:</span> <strong className="text-blue-300">{new Date(selectedOrder.waiterAcceptedAt).toLocaleTimeString()}</strong></div>
                      )}
                      {selectedOrder.deliveredAt && (
                        <div><span className="text-zinc-500">Delivered At:</span> <strong className="text-emerald-400">{new Date(selectedOrder.deliveredAt).toLocaleTimeString()}</strong></div>
                      )}
                      {selectedOrder.deliveryDuration !== null && selectedOrder.deliveryDuration !== undefined && (
                        <div><span className="text-zinc-500">Delivery Duration:</span> <strong className="text-amber-400">{Math.floor(selectedOrder.deliveryDuration / 60)}m {selectedOrder.deliveryDuration % 60}s</strong></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items breakdown list */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Itemized Breakdown</h4>
                  <div className="flex flex-col gap-2.5">
                    {selectedOrder.items?.map((item: any) => (
                      <div key={item.id} className="pb-2 border-b border-[#201011] last:border-0 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-extrabold text-zinc-200">{item.name}</span>
                          <span className="text-[10px] text-zinc-500 block mt-0.5">Quantity: {item.quantity} × ₹{item.price}</span>
                        </div>
                        <span className="font-mono font-bold text-white">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bill Breakdown */}
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

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
